import {
  categoryRepo,
  importReceiptRepo,
  productRepo,
  stockMovementRepo,
} from "../../repositories";
import type { IImportReceiptItem } from "../../models/ImportReceipt";
import { ensureStandardProductCodesMigrated } from "../../config/seed";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { ok, ServiceResult } from "../../shared/result";
import {
  buildVariantKey,
  buildVariantSku,
  generateProductCode,
  extractVariantFromText,
  generateVariantProductCode,
  isNewSchemeProduct,
  isStandardSixDigitProductCode,
  normalizeToCompactUpperCode,
} from "../../shared/productCode";
import {
  getBarcodeCandidatesServer,
  isScannedCodeMatchServer,
  matchTagToItems,
} from "../../shared/tagMatch";
import { ocrScanTag, sanitizeBarcode, validateOcrInput } from "../../infra/ocr";
import { createProductFromImportProposal, findCodeConflictsInList, findExistingProductForImport, loadImportSchemeContext, proposeImportProduct, resolveExplicitImportSchemeItem, resolveImportColorCode } from "../catalog";
import {
  applyFloorDelta,
  floorLabel,
  formatProductWithVariant,
  getFloorStocks,
  normalizeFloor,
  sanitizeColorHexes,
} from "../inventory";
import {
  inferReceiptActorRole,
  inferRole,
  isFullItem,
  keepCheckerFields,
  normalizeImportItems,
  progressOfItems,
} from "./import.rules";
import { withImportLock } from "./importLock.rules";
import { buildStaffRoleMap } from "./importReceipt.service";

async function applyMatchedScan(params: {
  id: string;
  receipt: any;
  items: IImportReceiptItem[];
  matchedIndex: number;
  delta: 1 | -1;
  explicitActualQuantity?: number;
  user?: { userId?: string; fullName?: string; role?: string };
  learnedBarcode?: string;
}) {
  const { id, receipt, items, matchedIndex, delta, explicitActualQuantity, user, learnedBarcode } = params;
  const current = items[matchedIndex];
  const expected = Number(current.expectedQuantity) || 0;
  const cleanBarcode = sanitizeBarcode(learnedBarcode);

  if (explicitActualQuantity === undefined && delta === 1 && isFullItem(current)) {
    let latestReceipt = receipt;
    if (cleanBarcode && !current.barcode) {
      items[matchedIndex] = { ...current, barcode: cleanBarcode };
      latestReceipt = await importReceiptRepo.updateById(id, { items });
    }
    return {
      matched: true,
      alreadyFull: true,
      isFull: true,
      matchedIndex,
      matchedItem: items[matchedIndex],
      scannedQuantity: current.scannedQuantity,
      expectedQuantity: expected,
      warning: `"${current.productName}" đã đủ số lượng (${current.scannedQuantity}/${expected}). Chiếc này có thể là hàng THỪA.`,
      progress: progressOfItems(items),
      receipt: latestReceipt,
    };
  }

  const scanned =
    explicitActualQuantity !== undefined && !isNaN(Number(explicitActualQuantity))
      ? Math.max(0, Math.round(Number(explicitActualQuantity)))
      : Math.max(0, current.scannedQuantity + delta);
  const full = scanned >= Math.max(1, expected);

  const userId = String(user?.userId || '');
  const userName = user?.fullName || 'Không xác định';
  const userRole = inferRole(user?.role, userId, userName);
  const scanCounts = (Array.isArray(current.scanCounts) ? current.scanCounts : []).map((s) => ({ ...s }));
  if (scanned !== current.scannedQuantity) {
    if (delta === 1) {
      const mine = scanCounts.find((s) => s.userId === userId);
      if (mine) {
        mine.quantity += 1;
        mine.name = userName;
        mine.role = userRole;
      } else {
        scanCounts.push({ userId, name: userName, role: userRole, quantity: 1 });
      }
    } else {
      const target =
        scanCounts.find((s) => s.userId === userId && s.quantity > 0) ||
        [...scanCounts].reverse().find((s) => s.quantity > 0);
      if (target) target.quantity -= 1;
    }
  }

  const activeScanCounts = scanCounts.filter((s) => s.quantity > 0);
  const lastActiveScanner =
    activeScanCounts.length > 0 ? activeScanCounts[activeScanCounts.length - 1] : null;
  const nextCheckedBy =
    delta === 1
      ? userId
      : lastActiveScanner
      ? lastActiveScanner.userId
      : '';
  const nextCheckedByName =
    delta === 1
      ? userName
      : lastActiveScanner
      ? lastActiveScanner.name
      : '';
  const nextCheckedByRole =
    delta === 1
      ? userRole
      : lastActiveScanner
      ? inferRole(lastActiveScanner.role, lastActiveScanner.userId, lastActiveScanner.name)
      : '';

  const matchedItem: IImportReceiptItem = {
    ...current,
    barcode: cleanBarcode || current.barcode || current.variantCode || current.productCode || '',
    scanCounts: activeScanCounts,
    checkedBy: nextCheckedBy,
    checkedByName: nextCheckedByName,
    checkedByRole: nextCheckedByRole,
    checkedAt: scanned > 0 ? (delta === 1 ? new Date() : current.checkedAt || new Date()) : undefined,
    scannedQuantity: scanned,
    actualQuantity: scanned,
    isChecked: scanned > 0,
    isConfirmed: full,
    discrepancyNote:
      scanned === 0
        ? ''
        : full
        ? scanned === expected
          ? 'Khớp đủ'
          : `Thừa ${scanned - expected} ${current.unit}`
        : `Đã quét ${scanned}/${expected} ${current.unit}`,
  };
  items[matchedIndex] = matchedItem;
  const updatedReceipt = await importReceiptRepo.updateById(id, { items });

  return {
    matched: true,
    alreadyFull: false,
    isFull: full,
    undone: delta === -1,
    matchedIndex,
    matchedItem,
    scannedQuantity: scanned,
    expectedQuantity: expected,
    discrepancy: scanned - expected,
    progress: progressOfItems(items),
    receipt: updatedReceipt,
  };
}

async function findRowByKnownBarcode(items: IImportReceiptItem[], barcode: string): Promise<number | null> {
  if (!barcode) return null;
  const candidates = getBarcodeCandidatesServer(barcode);

  // 1. Ưu tiên khớp chính xác Mã con (variantCode) hoặc barcode riêng của dòng
  const variantMatches = items
    .map((it, i) => {
      const vc = it.variantCode || generateVariantProductCode(it.productCode, it.color, it.size);
      const fullVc = normalizeToCompactUpperCode(`${it.productCode || ''}${it.color || ''}${it.size || ''}`);
      return { it, i, vc, fullVc };
    })
    .filter(
      ({ it, vc, fullVc }) =>
        (it.barcode && (it.barcode === barcode || isScannedCodeMatchServer(barcode, it.barcode))) ||
        (vc && isScannedCodeMatchServer(barcode, vc)) ||
        (fullVc && isScannedCodeMatchServer(barcode, fullVc))
    );

  if (variantMatches.length > 0) {
    const unfull = variantMatches.find(({ it }) => !isFullItem(it));
    return (unfull || variantMatches[0]).i;
  }

  // 2. Fallback khớp Mã gốc (productCode) nếu chỉ có 1 dòng mang mã gốc đó
  const directRoot = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => isScannedCodeMatchServer(barcode, it.productCode));
  if (directRoot.length === 1) {
    return directRoot[0].i;
  }
  if (directRoot.length > 1) {
    const unfull = directRoot.find(({ it }) => !isFullItem(it));
    return (unfull || directRoot[0]).i;
  }

  // 3. Tra cứu trong danh mục sản phẩm (khớp variantCode của biến thể hoặc mã gốc)
  const allProducts = await productRepo.find({});
  for (const prod of allProducts) {
    const floors = getFloorStocks(prod);
    const matchedVar = floors.variants.find(
      (v) =>
        isScannedCodeMatchServer(barcode, v.variantCode) ||
        isScannedCodeMatchServer(barcode, v.barcode)
    );
    if (matchedVar) {
      const byVar = items
        .map((it, i) => ({ it, i }))
        .filter(
          ({ it }) =>
            it.productCode === prod.code &&
            buildVariantKey(it.color, it.size) === matchedVar.variantKey
        );
      if (byVar.length > 0) {
        const unfull = byVar.find(({ it }) => !isFullItem(it));
        return (unfull || byVar[0]).i;
      }
    }
  }

  let product = await productRepo.findOne({ barcode });
  if (!product) {
    for (const cand of candidates) {
      product = (await productRepo.findOne({ code: cand })) || (await productRepo.findOne({ barcode: cand }));
      if (product) break;
    }
  }
  if (product && product.code) {
    const byProduct = items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.productCode === product.code);
    if (byProduct.length > 0) {
      const unfull = byProduct.find(({ it }) => !isFullItem(it));
      return (unfull || byProduct[0]).i;
    }
  }
  return null;
}

// POST /api/v1/imports/parse-file — Bóc tách file Excel (.xlsx, .csv) hoặc PDF thành danh sách hàng nhập kho

// POST /api/v1/imports/ocr-preview

// POST /api/v1/imports/ocr-scan

// GET /api/v1/imports

// GET /api/v1/imports/:id

// POST /api/v1/imports

// PUT /api/v1/imports/:id

// POST /api/v1/imports/:id/finish-listing

// DELETE /api/v1/imports/:id

// POST /api/v1/imports/:id/scan-check

// POST /api/v1/imports/:id/scan-tag

// POST /api/v1/imports/:id/complete (Hoàn thành nhập kho — cộng dồn biến thể Size/Màu kèm Mã con variantCode vào Mã sản phẩm chung)


export async function scanCheck(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
      const receipt = await importReceiptRepo.findById(id);
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }

    if (receipt.status === 'COMPLETED') {
      throw new ApiError(400, 'IMPORT_RECEIPT_LOCKED', 'Phiếu nhập đã hoàn thành');
    }
    if (receipt.status !== 'CHECKING') {
      throw new ApiError(
        400,
        'IMPORT_NOT_CHECKING',
        'Vui lòng bấm "Hoàn tất" danh sách kiểm hàng trước khi quét tag kiểm tra thực tế'
      );
    }

    const { query, productCode, productName, barcode, codes, rawText, rowIndex } = body || {};
    const delta: 1 | -1 = Number(body?.delta) === -1 ? -1 : 1;
    const hasRowIndex = rowIndex !== undefined && rowIndex !== null && rowIndex !== '';
    const cleanBarcode = sanitizeBarcode(barcode);
    const label = String(productName || query || productCode || cleanBarcode || barcode || '').trim();
    if (!hasRowIndex && !label) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng cung cấp mã hoặc tên hàng đọc được từ tag');
    }
    if (delta === -1 && !hasRowIndex) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Hoàn tác lần quét cần chỉ rõ dòng hàng (rowIndex)');
    }

    const items = receipt.items.map((it) => ({
      ...it,
      variantCode: it.variantCode || generateVariantProductCode(it.productCode, it.color, it.size),
      scannedQuantity: Math.max(0, Number(it.scannedQuantity) || 0),
    }));

    let matchedIndex: number | null = null;
    if (hasRowIndex) {
      const idx = Number(rowIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) {
        throw new ApiError(400, 'INVALID_ROW_INDEX', 'Dòng hàng được chọn không hợp lệ');
      }
      matchedIndex = idx;
    } else {
      if (cleanBarcode) {
        matchedIndex = await findRowByKnownBarcode(items, String(barcode || cleanBarcode));
      }
      if (matchedIndex === null) {
        const result = matchTagToItems(
          items.map((it) => ({
            productCode: it.productCode,
            variantCode: it.variantCode,
            productName: it.productName,
            color: it.color,
            size: it.size,
            barcode: it.barcode,
            isChecked: isFullItem(it),
          })),
          { query, productCode, productName, barcode: cleanBarcode, codes, rawText }
        );
        if (result.ambiguous) {
          return ok({
              matched: false,
              ambiguous: true,
              candidates: result.candidates.map((i) => ({
                index: i,
                productCode: items[i].productCode,
                variantCode: items[i].variantCode,
                color: items[i].color,
                size: items[i].size,
                productName: items[i].productName,
                scannedQuantity: items[i].scannedQuantity,
                expectedQuantity: items[i].expectedQuantity,
              })),
              warning: `Tag "${label}" khớp nhiều dòng trong danh sách. Vui lòng chọn đúng dòng.`,
              progress: progressOfItems(items),
              receipt,
            }, {});
        }
        matchedIndex = result.index;
      }
    }

    if (matchedIndex === null) {
      return ok({
          matched: false,
          warning: `Tag "${label}" KHÔNG có trong danh sách kiểm hàng. Hàng này không được tự thêm vào phiếu.`,
          progress: progressOfItems(items),
          receipt,
        }, {});
    }

    const applied = await applyMatchedScan({
      id,
      receipt,
      items,
      matchedIndex,
      delta,
      explicitActualQuantity:
        body?.actualQuantity !== undefined ? Number(body.actualQuantity) : undefined,
      user: ctx.user,
      learnedBarcode: cleanBarcode,
    });

    return ok(applied, {});
}

export async function scanTag(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  const startedAt = Date.now();
  let ocrMs = 0;
  const finishWithTiming = (payload: Record<string, any>): ServiceResult => {
    const totalMs = Date.now() - startedAt;
    return ok(
      { ...payload, timing: { ocrMs, totalMs } },
      {},
      { "Server-Timing": `ocr;dur=${ocrMs}, total;dur=${totalMs}` }
    );
  };

        const receipt = await importReceiptRepo.findById(id);
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }
    if (receipt.status === 'COMPLETED') {
      throw new ApiError(400, 'IMPORT_RECEIPT_LOCKED', 'Phiếu nhập đã hoàn thành');
    }
    if (receipt.status !== 'CHECKING') {
      throw new ApiError(
        400,
        'IMPORT_NOT_CHECKING',
        'Vui lòng bấm "Hoàn tất" danh sách kiểm hàng trước khi quét tag kiểm tra thực tế'
      );
    }

    const { fileBase64, mimeType, barcode: rawBarcode } = body || {};
    const clientBarcode = sanitizeBarcode(rawBarcode);
    const hasFile = typeof fileBase64 === 'string' && fileBase64.trim().length > 0;

    if (!clientBarcode && !hasFile) {
      throw new ApiError(400, 'OCR_INVALID_FILE', 'Thiếu ảnh chụp tag (fileBase64) hoặc mã vạch (barcode).');
    }

    const items = receipt.items.map((it) => ({
      ...it,
      variantCode: it.variantCode || generateVariantProductCode(it.productCode, it.color, it.size),
      scannedQuantity: Math.max(0, Number(it.scannedQuantity) || 0),
    }));

    if (clientBarcode) {
      const fastRowIndex = await findRowByKnownBarcode(items, clientBarcode);
      if (fastRowIndex !== null) {
        const applied = await applyMatchedScan({
          id,
          receipt,
          items,
          matchedIndex: fastRowIndex,
          delta: 1,
          user: ctx.user,
          learnedBarcode: clientBarcode,
        });
        return finishWithTiming({
          ...applied,
          source: 'barcode',
          barcode: clientBarcode,
          ocr: null,
        });
      }

      if (!hasFile) {
        const byCode = matchTagToItems(
          items.map((it) => ({
            productCode: it.productCode,
            variantCode: it.variantCode,
            productName: it.productName,
            color: it.color,
            size: it.size,
            barcode: it.barcode,
            isChecked: isFullItem(it),
          })),
          { query: clientBarcode, productCode: clientBarcode, barcode: clientBarcode }
        );
        if (byCode.index !== null) {
          const applied = await applyMatchedScan({
            id,
            receipt,
            items,
            matchedIndex: byCode.index,
            delta: 1,
            user: ctx.user,
            learnedBarcode: clientBarcode,
          });
          return finishWithTiming({
            ...applied,
            source: 'barcode',
            barcode: clientBarcode,
            ocr: null,
          });
        }
        return finishWithTiming({
          matched: false,
          source: 'barcode',
          barcode: clientBarcode,
          ocr: null,
          warning: `Mã vạch "${clientBarcode}" chưa khớp dòng nào trong danh sách kiểm hàng.`,
          progress: progressOfItems(items),
          receipt,
        });
      }
    }

    const { data, mime } = validateOcrInput(fileBase64, mimeType || 'image/jpeg');
    const ocrStartedAt = Date.now();
    const tag = await ocrScanTag(data, mime);
    ocrMs = Date.now() - ocrStartedAt;

    const finalBarcode = clientBarcode || tag.barcode || '';
    const ocrSummary = {
      productName: tag.productName,
      productCode: tag.productCode,
      barcode: finalBarcode,
      model: tag.model || tag.engine,
    };

    if (!tag.productCode && !tag.productName && !finalBarcode) {
      return finishWithTiming({
        matched: false,
        unreadable: true,
        source: 'ocr',
        barcode: '',
        ocr: ocrSummary,
        warning: 'Không đọc được tag. Đưa tag gần hơn, đủ sáng, chụp thẳng rồi thử lại.',
        progress: progressOfItems(items),
        receipt,
      });
    }

    let matchedIndex: number | null = null;
    if (finalBarcode) {
      matchedIndex = await findRowByKnownBarcode(items, finalBarcode);
    }

    if (matchedIndex === null) {
      const result = matchTagToItems(
        items.map((it) => ({
          productCode: it.productCode,
          variantCode: it.variantCode,
          productName: it.productName,
          color: it.color,
          size: it.size,
          barcode: it.barcode,
          isChecked: isFullItem(it),
        })),
        {
          productCode: tag.productCode,
          productName: tag.productName,
          barcode: finalBarcode,
          codes: tag.codes,
          rawText: tag.rawText,
        }
      );

      if (result.ambiguous) {
        const label = tag.productName || tag.productCode || finalBarcode;
        return finishWithTiming({
          matched: false,
          ambiguous: true,
          source: 'ocr',
          barcode: finalBarcode,
          ocr: ocrSummary,
          candidates: result.candidates.map((i) => ({
            index: i,
            productCode: items[i].productCode,
            variantCode: items[i].variantCode,
            color: items[i].color,
            size: items[i].size,
            productName: items[i].productName,
            scannedQuantity: items[i].scannedQuantity,
            expectedQuantity: items[i].expectedQuantity,
          })),
          warning: `Tag "${label}" khớp nhiều dòng trong danh sách. Vui lòng chọn đúng dòng.`,
          progress: progressOfItems(items),
          receipt,
        });
      }
      matchedIndex = result.index;
    }

    if (matchedIndex === null) {
      const label = tag.productName || tag.productCode || finalBarcode;
      return finishWithTiming({
        matched: false,
        source: 'ocr',
        barcode: finalBarcode,
        ocr: ocrSummary,
        warning: `Tag "${label}" KHÔNG có trong danh sách kiểm hàng. Hàng này không được tự thêm vào phiếu.`,
        progress: progressOfItems(items),
        receipt,
      });
    }

    const applied = await applyMatchedScan({
      id,
      receipt,
      items,
      matchedIndex,
      delta: 1,
      user: ctx.user,
      learnedBarcode: finalBarcode,
    });

    return finishWithTiming({
      ...applied,
      source: 'ocr',
      barcode: finalBarcode,
      ocr: ocrSummary,
    });
}

export async function completeImport(ctx: ServiceContext, id: string, body?: any): Promise<ServiceResult> {
      const result = await withImportLock(`RECEIPT:${id}`, async () => {
    const receipt = await importReceiptRepo.findById(id);
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }

    if (receipt.status === 'COMPLETED') {
      throw new ApiError(
        400,
        'IMPORT_RECEIPT_ALREADY_COMPLETED',
        'Phiếu nhập này đã được hoàn thành trước đó'
      );
    }

    // Chống ghi lịch sử nhập kho 2 lần nếu phiếu đã từng phát sinh bút toán IMPORT_RECEIPT
    const existingImportMovements = await stockMovementRepo.find({
      referenceId: String(receipt._id),
      referenceType: 'IMPORT_RECEIPT',
    });
    if (existingImportMovements.length > 0) {
      await importReceiptRepo.updateById(id, { status: 'COMPLETED' });
      throw new ApiError(
        400,
        'IMPORT_RECEIPT_ALREADY_COMPLETED',
        'Phiếu nhập này đã được ghi nhận lịch sử nhập kho trước đó'
      );
    }

    const categories = await categoryRepo.find({});
    const defaultCategory =
      categories.find((c) => String(c._id) === String(receipt.defaultCategoryId)) ||
      categories[0];

    const schemeCtx = await loadImportSchemeContext();
    const finalItems = body?.items
      ? keepCheckerFields(
          normalizeImportItems(body.items, receipt.defaultCategoryId, categories, schemeCtx),
          receipt.items
        )
      : receipt.items;
    // Phiên hoàn thành dùng colorCode đã lưu trên từng dòng (tem đã in) => làm mới bộ nhớ đệm màu & đề xuất
    schemeCtx.colorCodes.clear();
    schemeCtx.proposals.clear();

    const confirmedItems = finalItems.filter((i) => i.isConfirmed);
    if (confirmedItems.length === 0) {
      throw new ApiError(
        400,
        'NO_CONFIRMED_ITEMS',
        'Vui lòng tick xác nhận ít nhất 1 dòng hàng đã kiểm trước khi bấm Hoàn thành nhập kho'
      );
    }

    const targetFloor = normalizeFloor(body?.targetWarehouse || receipt.targetWarehouse);
    const createdMovements: any[] = [];
    const updatedItems: IImportReceiptItem[] = [];

    for (const item of finalItems) {
      if (!item.isConfirmed) {
        updatedItems.push(item);
        continue;
      }

      const itemCat =
        categories.find((c) => String(c._id) === String(item.categoryId)) ||
        defaultCategory;

      const itemUnit = String(item.unit || 'Cái').trim() || 'Cái';
      const extracted = extractVariantFromText(item.productName, {
        categoryCode: itemCat?.code,
        categoryName: itemCat?.name,
        brand: item.brand,
        existingCode: item.productCode,
      });
      const itemColor = item.color !== undefined ? String(item.color).trim() : extracted.color;
      const itemSize =
        item.size !== undefined ? String(item.size).trim().toUpperCase() : extracted.size;
      const cleanBaseName = extracted.baseName || item.productName;
      const hasExplicitScheme = Boolean(
        item.brandId && (String(item.versionCode || '').trim() || String(item.versionName || '').trim())
      );

      // v5.0: ưu tiên khớp CHÍNH XÁC sản phẩm có sẵn (productId / mã gốc / mã con / mã cũ),
      // nếu dòng truyền brandId + (versionCode | versionName) => sinh mã theo scheme mới chính xác từ các trường đó;
      // sản phẩm chưa có => tạo theo quy chuẩn mã mới (không sinh lại mã cũ theo tên).
      let product: any = item.productId
        ? findExistingProductForImport({ productId: item.productId }, schemeCtx.products)
        : !hasExplicitScheme
        ? findExistingProductForImport(item, schemeCtx.products)
        : null;

      if (!product && itemCat && hasExplicitScheme) {
        const explicitProposal = resolveExplicitImportSchemeItem(schemeCtx, {
          categoryId: String(itemCat._id),
          brandId: String(item.brandId),
          versionName: item.versionName,
          versionCode: item.versionCode,
          color: itemColor,
          colorCode: item.colorCode,
          size: itemSize,
        });
        if (explicitProposal.existing) {
          product = explicitProposal.existing;
        } else {
          const defaultProdName =
            cleanBaseName ||
            `${explicitProposal.brand.isSystem ? '' : explicitProposal.brand.name + ' '}${explicitProposal.versionName}`.trim();
          product = await createProductFromImportProposal(explicitProposal, {
            name: defaultProdName,
            categoryId: String(itemCat._id),
            unit: itemUnit,
            sellingPrice: Math.max(0, Math.round(Number(item.sellingPrice) || 0)),
            costPrice: Math.max(0, Math.round(Number(item.costPrice) || 0)),
          });
          schemeCtx.products.push(product);
        }
      } else if (!product && itemCat && !isStandardSixDigitProductCode(item.productCode)) {
        const proposal = proposeImportProduct(schemeCtx, {
          name: cleanBaseName,
          brand: item.brand,
          categoryId: String(itemCat._id),
        });
        if (proposal?.existing) {
          product = proposal.existing;
        } else if (proposal) {
          product = await createProductFromImportProposal(proposal, {
            name: cleanBaseName,
            categoryId: String(itemCat._id),
            unit: itemUnit,
            sellingPrice: Math.max(0, Math.round(Number(item.sellingPrice) || 0)),
            costPrice: Math.max(0, Math.round(Number(item.costPrice) || 0)),
          });
          schemeCtx.products.push(product);
        }
      }

      let code = product ? product.code :
        (item.productCode && isStandardSixDigitProductCode(item.productCode)
          ? item.productCode
          : '') ||
        extracted.code ||
        generateProductCode(cleanBaseName, {
          categoryCode: itemCat?.code,
          categoryName: itemCat?.name,
          brand: item.brand || extracted.brand,
        });
      if (!product) product = await productRepo.findOne({ code });
      if (
        product &&
        !isNewSchemeProduct(product) &&
        !findExistingProductForImport(item, schemeCtx.products) &&
        String(product.unit || 'Cái').trim().toLowerCase() !== itemUnit.toLowerCase()
      ) {
        code = generateProductCode(cleanBaseName, {
          categoryCode: itemCat?.code,
          categoryName: itemCat?.name,
          brand: item.brand || extracted.brand,
          seedSuffix: itemUnit,
        });
        product = await productRepo.findOne({ code });
      }

      const newScheme = product ? isNewSchemeProduct(product) : false;
      const itemColorCode =
        newScheme && product
          ? resolveImportColorCode(schemeCtx, product.code, product.variants || [], itemColor, item.colorCode)
          : '';
      let childVariantCode = newScheme
        ? buildVariantSku(code, itemColorCode, itemSize)
        : generateVariantProductCode(code, itemColor, itemSize);
      if (newScheme && product) {
        const conflicts = findCodeConflictsInList(schemeCtx.products, [childVariantCode], String(product._id));
        if (conflicts.length > 0) {
          throw new ApiError(
            409,
            'CODE_CONFLICT',
            `Mã ${conflicts[0].code} đã được dùng bởi sản phẩm ${conflicts[0].productCode}`,
            { code: conflicts[0].code, conflictProductId: conflicts[0].productId }
          );
        }
      }
      const itemCostPrice = Math.max(0, Math.round(Number(item.costPrice) || 0));
      const itemSellingPrice = Math.max(0, Math.round(Number(item.sellingPrice) || 0));
      const itemBarcode = childVariantCode || sanitizeBarcode(item.barcode) || code;

      if (!product) {
        product = await productRepo.create({
          code,
          name: cleanBaseName,
          brand: item.brand || extracted.brand || '',
          modelName: extracted.modelName || '',
          categoryId: itemCat ? itemCat._id : '',
          categoryCode: itemCat ? itemCat.code : 'AO',
          categoryName: itemCat ? itemCat.name : 'Áo thể thao',
          unit: itemUnit,
          sellingPrice: itemSellingPrice,
          costPrice: itemCostPrice,
          barcode: code,
          variants: [],
          stockFloor1: 0,
          stockFloor2: 0,
          stock: 0,
          status: 'ACTIVE',
        });
      }

      const qtyToAdd = Math.max(0, Math.round(Number(item.actualQuantity)));
      const beforeFloors = getFloorStocks(product);
      const balanceBefore = beforeFloors.stock;
      const nextFloors = applyFloorDelta(
        product,
        targetFloor,
        qtyToAdd,
        itemColor,
        itemSize,
        item.colorHexes,
        itemColorCode
      );
      const balanceAfter = nextFloors.stock;
      const touchedVariant =
        itemColor || itemSize
          ? nextFloors.variants.find((v) => v.variantKey === buildVariantKey(itemColor, itemSize))
          : undefined;
      if (touchedVariant) {
        if (touchedVariant.variantCode) childVariantCode = touchedVariant.variantCode;
        // v5.0 (R8): nhập kho cập nhật giá vốn của đúng biến thể
        if (itemCostPrice > 0) touchedVariant.costPrice = itemCostPrice;
      }

      const productUpdate: Record<string, any> = {
        variants: nextFloors.variants,
        stockFloor1: nextFloors.stockFloor1,
        stockFloor2: nextFloors.stockFloor2,
        stock: nextFloors.stock,
      };
      if (itemCostPrice > 0) productUpdate.costPrice = itemCostPrice;
      if (itemSellingPrice > 0) productUpdate.sellingPrice = itemSellingPrice;
      if (!product.barcode) productUpdate.barcode = code;
      if (item.brand && !product.brand) productUpdate.brand = item.brand;

      const savedProduct = await productRepo.updateById(product._id, productUpdate);
      if (savedProduct) {
        const idx = schemeCtx.products.findIndex((p) => String(p._id) === String(savedProduct._id));
        if (idx >= 0) schemeCtx.products[idx] = savedProduct;
        else schemeCtx.products.push(savedProduct);
      }

      const hasExplicitUser = Boolean(!ctx.isFallbackUser && ctx.user?.userId);
      const actorId = hasExplicitUser
        ? ctx.user!.userId
        : receipt.createdBy || ctx.user?.userId || 'ACCOUNTANT';
      const actorName = hasExplicitUser
        ? ctx.user!.fullName
        : receipt.createdByName || ctx.user?.fullName || 'Kế toán kho';
      const actorRole = inferRole(
        hasExplicitUser ? ctx.user?.role : receipt.createdByRole || ctx.user?.role,
        actorId,
        actorName
      );

      const movement = await stockMovementRepo.create({
        type: 'IMPORT',
        productId: product._id,
        productCode: product.code,
        productName: formatProductWithVariant(product.name, itemColor, itemSize),
        color: itemColor,
        size: itemSize,
        categoryId: product.categoryId,
        unit: product.unit,
        quantityChange: qtyToAdd,
        balanceBefore,
        balanceAfter,
        warehouseLocation: targetFloor,
        referenceType: 'IMPORT_RECEIPT',
        referenceId: receipt._id,
        referenceCode: receipt.code,
        performedBy: actorId,
        performedByName: actorName,
        performedByRole: actorRole,
        note: `${item.discrepancyNote || item.note || `Nhập kho theo phiếu ${receipt.code}`} (${floorLabel(targetFloor)})`,
      });

      createdMovements.push(movement);
      updatedItems.push({
        ...item,
        productId: product._id,
        productCode: product.code,
        brandId: (product as any).brandId || item.brandId || '',
        versionName: (product as any).versionName || item.versionName || '',
        versionCode: (product as any).versionCode || item.versionCode || '',
        variantCode: childVariantCode,
        colorCode: itemColorCode,
        color: itemColor,
        size: itemSize,
        barcode: itemColor || itemSize ? childVariantCode : itemBarcode,
        checkedBy: item.checkedBy || receipt.createdBy || actorId,
        checkedByName: item.checkedByName || receipt.createdByName || actorName,
        checkedByRole:
          item.checkedByRole ||
          inferRole(receipt.createdByRole, receipt.createdBy, receipt.createdByName) ||
          actorRole,
        checkedAt: item.checkedAt || new Date(),
      });
    }

    const hasExplicitCompleter = Boolean(!ctx.isFallbackUser && ctx.user?.userId);
    const completedBy = hasExplicitCompleter
      ? ctx.user!.userId
      : receipt.createdBy || ctx.user?.userId || 'ACCOUNTANT';
    const completedByName = hasExplicitCompleter
      ? ctx.user!.fullName
      : receipt.createdByName || ctx.user?.fullName || 'Kế toán kho';
    const completedByRole = inferRole(
      hasExplicitCompleter ? ctx.user?.role : receipt.createdByRole || ctx.user?.role,
      completedBy,
      completedByName
    );

    const completedReceipt = await importReceiptRepo.updateById(id, {
      status: 'COMPLETED',
      targetWarehouse: targetFloor,
      items: updatedItems,
      completedBy,
      completedByName,
      completedByRole,
      completedAt: new Date(),
    });

    return {
      data: {
        receipt: completedReceipt,
        movements: createdMovements,
      },
      meta: {
        confirmedCount: confirmedItems.length,
        totalItems: updatedItems.length,
      },
    };
    });

    return ok((result as any).data, (result as any).meta);
}

