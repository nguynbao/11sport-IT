import { Router } from 'express';
import {
  importReceiptRepo,
  productRepo,
  categoryRepo,
  stockMovementRepo,
  staffRepo,
} from '../config/db';
import { ensureStandardProductCodesMigrated } from '../config/seed';
import {
  generateProductCode,
  generateVariantProductCode,
  extractVariantFromText,
  buildVariantKey,
  isStandardSixDigitProductCode,
  normalizeToCompactUpperCode,
} from '../utils/productCode';
import {
  matchTagToItems,
  isScannedCodeMatchServer,
  getBarcodeCandidatesServer,
} from '../utils/tagMatch';
import { ApiError } from '../utils/errors';
import { IImportReceiptItem } from '../models/ImportReceipt';
import {
  normalizeFloor,
  floorLabel,
  applyFloorDelta,
  getFloorStocks,
  formatProductWithVariant,
} from '../utils/warehouseFloor';
import { filterAndRankBySearch } from '../utils/search';
import {
  OcrTableRow,
  parseTextToRows,
  validateOcrInput,
  ocrScanTable,
  ocrScanTag,
  sanitizeBarcode,
} from '../utils/ocr';
import {
  parseXlsxBufferToMatrix,
  parseCsvTextToMatrix,
  extractTextFromPdfBuffer,
  convertMatrixToImportRows,
  parseRawTextToImportRows,
  ParsedImportFileRow,
} from '../utils/fileImportParser';

export const importsRouter = Router();

function inferRole(
  explicitRole?: string,
  userId?: string,
  userName?: string,
  staffRoleMap?: Map<string, string>
): string {
  const cleanRole = String(explicitRole || '').trim().toUpperCase();
  if (cleanRole === 'ADMIN' || cleanRole === 'WAREHOUSE' || cleanRole === 'SALES') {
    return cleanRole;
  }
  const uid = String(userId || '').trim();
  if (uid && staffRoleMap?.has(uid)) {
    return staffRoleMap.get(uid)!;
  }
  const upperId = uid.toUpperCase();
  if (upperId === 'ADMIN') return 'ADMIN';
  if (upperId === 'WAREHOUSE') return 'WAREHOUSE';
  const nameLower = String(userName || '').toLowerCase();
  if (nameLower.includes('admin') || nameLower.includes('quản trị') || nameLower.includes('quản lý')) {
    return 'ADMIN';
  }
  return 'WAREHOUSE';
}

async function buildStaffRoleMap(): Promise<Map<string, string>> {
  const staffs = await staffRepo.find({});
  const map = new Map<string, string>();
  for (const s of staffs) {
    if (s._id && s.role) map.set(String(s._id), String(s.role).toUpperCase());
    if (s.username && s.role) map.set(String(s.username), String(s.role).toUpperCase());
  }
  return map;
}

async function buildProductPriceMap(): Promise<
  Map<string, { costPrice: number; sellingPrice: number }>
> {
  const products = await productRepo.find({});
  const map = new Map<string, { costPrice: number; sellingPrice: number }>();
  for (const p of products) {
    const info = {
      costPrice: Number(p.costPrice || 0),
      sellingPrice: Number(p.sellingPrice || 0),
    };
    if (p._id) map.set(String(p._id).trim(), info);
    if (p.code) map.set(String(p.code).trim().toUpperCase(), info);
    if (p.name) map.set(String(p.name).trim().toLowerCase(), info);
  }
  return map;
}

function enrichReceiptRoles(
  receipt: any,
  staffRoleMap: Map<string, string>,
  productPriceMap?: Map<string, { costPrice: number; sellingPrice: number }>
) {
  if (!receipt) return receipt;
  const createdByRole = inferReceiptActorRole(
    receipt.createdByRole,
    receipt.createdBy,
    receipt.createdByName,
    staffRoleMap
  );
  const completedByRole =
    receipt.completedBy || receipt.completedByName
      ? inferReceiptActorRole(
          receipt.completedByRole,
          receipt.completedBy,
          receipt.completedByName,
          staffRoleMap
        )
      : '';
  const items = Array.isArray(receipt.items)
    ? receipt.items.map((it: any) => {
        const hasAttr = Boolean(
          (it.color && String(it.color).trim()) || (it.size && String(it.size).trim())
        );
        const computedVariantCode = hasAttr
          ? generateVariantProductCode(it.productCode || '', it.color || '', it.size || '')
          : it.variantCode || it.productCode || '';
        const matchedProdPrice =
          productPriceMap?.get(String(it.productId || '').trim()) ||
          productPriceMap?.get(String(it.productCode || '').trim().toUpperCase()) ||
          productPriceMap?.get(String(it.productName || '').trim().toLowerCase());
        const costPrice =
          Number(it.costPrice) > 0
            ? Number(it.costPrice)
            : Number(matchedProdPrice?.costPrice || 0);
        const sellingPrice =
          Number(it.sellingPrice) > 0
            ? Number(it.sellingPrice)
            : Number(matchedProdPrice?.sellingPrice || 0);
        return {
          ...it,
          costPrice,
          sellingPrice,
          variantCode: computedVariantCode,
          barcode: computedVariantCode || it.barcode || it.productCode || '',
          checkedByRole:
            it.checkedBy || it.checkedByName
              ? inferReceiptActorRole(it.checkedByRole, it.checkedBy, it.checkedByName, staffRoleMap)
              : '',
          scanCounts: Array.isArray(it.scanCounts)
            ? it.scanCounts.map((sc: any) => ({
                ...sc,
                role: inferReceiptActorRole(sc.role, sc.userId, sc.name, staffRoleMap),
              }))
            : [],
        };
      })
    : [];
  return {
    ...receipt,
    createdByRole,
    completedByRole,
    items,
  };
}

function inferReceiptActorRole(
  explicitRole?: string,
  userId?: string,
  userName?: string,
  staffRoleMap?: Map<string, string>
): string {
  return inferRole(explicitRole, userId, userName, staffRoleMap);
}

// Giá gốc (đơn giá nhập) do thủ kho nhập — số nguyên VND >= 0
function parseCostPrice(raw: any, stt: number): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const value = Math.round(Number(raw));
  if (isNaN(value) || value < 0) {
    throw new ApiError(400, 'INVALID_COST_PRICE', `Giá gốc dòng #${stt} phải là số nguyên không âm`, {
      costPrice: 'Giá gốc không hợp lệ',
    });
  }
  return value;
}

// Giá bán niêm yết do thủ kho / quản lý nhập — số nguyên VND >= 0
function parseSellingPrice(raw: any, stt: number): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const value = Math.round(Number(raw));
  if (isNaN(value) || value < 0) {
    throw new ApiError(400, 'INVALID_SELLING_PRICE', `Giá bán dòng #${stt} phải là số nguyên không âm`, {
      sellingPrice: 'Giá bán không hợp lệ',
    });
  }
  return value;
}

function normalizeImportItems(
  rawItems: any[],
  defaultCategoryId = '',
  categories: any[] = []
): IImportReceiptItem[] {
  if (!Array.isArray(rawItems)) return [];
  const catMap = new Map(categories.map((c) => [String(c._id), c]));
  return rawItems
    .filter((item) => item && (item.productName || item.productCode))
    .map((item, idx) => {
      const resolvedCatId = item.categoryId ? String(item.categoryId) : defaultCategoryId;
      const cat = catMap.get(String(resolvedCatId));
      const rawName = String(item.productName || item.productCode || '').trim();
      const extracted = extractVariantFromText(rawName, {
        categoryCode: cat?.code,
        categoryName: cat?.name,
        brand: item.brand ? String(item.brand).trim() : '',
        existingCode: item.productCode ? String(item.productCode) : '',
      });
      const color = item.color !== undefined ? String(item.color).trim() : extracted.color;
      const size =
        item.size !== undefined ? String(item.size).trim().toUpperCase() : extracted.size;
      const brand = item.brand !== undefined ? String(item.brand).trim() : extracted.brand;
      const productName =
        item.color !== undefined || item.size !== undefined
          ? extracted.baseName || rawName
          : rawName;
      const autoCode =
        extracted.code ||
        generateProductCode(productName, {
          categoryCode: cat?.code,
          categoryName: cat?.name,
          brand,
          existingCode: item.productCode ? String(item.productCode) : '',
        });
      const explicitCleanCode = item.productCode
        ? generateProductCode(String(item.productCode), { keepVariantInCode: true })
        : '';
      const productCode =
        explicitCleanCode && isStandardSixDigitProductCode(explicitCleanCode)
          ? explicitCleanCode
          : autoCode || explicitCleanCode;
      const variantCode = generateVariantProductCode(productCode, color, size);
      const expectedQuantity = Math.max(0, Math.round(Number(item.expectedQuantity ?? item.quantity ?? 0)));
      const actualQuantity =
        item.actualQuantity !== undefined
          ? Math.max(0, Math.round(Number(item.actualQuantity)))
          : expectedQuantity;

      const customBarcode = item.barcode ? sanitizeBarcode(item.barcode) : '';
      const finalBarcode =
        customBarcode && customBarcode !== productCode ? customBarcode : variantCode || productCode;

      return {
        stt: Number(item.stt) || idx + 1,
        productId: item.productId ? String(item.productId) : '',
        productCode,
        variantCode,
        productName,
        brand,
        color,
        size,
        categoryId: resolvedCatId,
        unit: item.unit ? String(item.unit).trim() : 'Cái',
        expectedQuantity,
        actualQuantity,
        costPrice: parseCostPrice(item.costPrice, Number(item.stt) || idx + 1),
        sellingPrice: parseSellingPrice(item.sellingPrice, Number(item.stt) || idx + 1),
        scannedQuantity: Math.max(0, Math.round(Number(item.scannedQuantity) || 0)),
        barcode: finalBarcode,
        note: item.note ? String(item.note).trim() : '',
        isChecked: Boolean(item.isChecked),
        isConfirmed: Boolean(item.isConfirmed),
        discrepancyNote: item.discrepancyNote ? String(item.discrepancyNote).trim() : '',
      };
    });
}

function keepCheckerFields(newItems: IImportReceiptItem[], oldItems: IImportReceiptItem[]): IImportReceiptItem[] {
  const used = new Set<number>();
  return newItems.map((item, idx) => {
    const matchSameRow = (o: IImportReceiptItem) =>
      o.productCode === item.productCode &&
      buildVariantKey(o.color, o.size) === buildVariantKey(item.color, item.size);

    let oi = oldItems[idx] && matchSameRow(oldItems[idx]) && !used.has(idx) ? idx : -1;
    if (oi < 0) oi = oldItems.findIndex((o, j) => !used.has(j) && matchSameRow(o));
    if (oi < 0) oi = oldItems.findIndex((o, j) => !used.has(j) && o.productCode === item.productCode);
    if (oi < 0) {
      return {
        ...item,
        checkedBy: '',
        checkedByName: '',
        checkedByRole: '',
        checkedAt: undefined,
        scanCounts: [],
        barcode: item.barcode || item.variantCode || item.productCode || '',
      };
    }
    used.add(oi);
    const old = oldItems[oi];
    return {
      ...item,
      barcode: item.variantCode || old.barcode || item.barcode || '',
      checkedBy: old.checkedBy || '',
      checkedByName: old.checkedByName || '',
      checkedByRole: old.checkedByRole || '',
      checkedAt: old.checkedAt,
      scanCounts: Array.isArray(old.scanCounts) ? old.scanCounts.map((s) => ({ ...s })) : [],
    };
  });
}

function rowsToImportItems(rows: OcrTableRow[], defaultCatId: string): IImportReceiptItem[] {
  return rows.map((r, index) => {
    const extracted = extractVariantFromText(r.productName);
    const code = extracted.code || generateProductCode(r.productName);
    const variantCode =
      extracted.variantCode || generateVariantProductCode(code, extracted.color, extracted.size);
    return {
      stt: index + 1,
      productId: '',
      productCode: code,
      variantCode,
      productName: extracted.baseName || r.productName,
      brand: extracted.brand,
      color: extracted.color,
      size: extracted.size,
      categoryId: defaultCatId,
      unit: r.unit || 'Cái',
      expectedQuantity: r.expectedQuantity,
      actualQuantity: r.expectedQuantity,
      costPrice: 0,
      sellingPrice: 0,
      scannedQuantity: 0,
      barcode: variantCode || code,
      note: r.note || '',
      isChecked: false,
      isConfirmed: false,
      discrepancyNote: '',
    };
  });
}

const isFullItem = (it: IImportReceiptItem) =>
  (Number(it.scannedQuantity) || 0) >= Math.max(1, Number(it.expectedQuantity) || 0);

const progressOfItems = (list: IImportReceiptItem[]) => ({
  checked: list.filter(isFullItem).length,
  total: list.length,
  scannedUnits: list.reduce((s, i) => s + (Number(i.scannedQuantity) || 0), 0),
  expectedUnits: list.reduce((s, i) => s + (Number(i.expectedQuantity) || 0), 0),
});

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

  const matchedItem: IImportReceiptItem = {
    ...current,
    barcode: cleanBarcode || current.barcode || current.variantCode || current.productCode || '',
    scanCounts: scanCounts.filter((s) => s.quantity > 0),
    ...(delta === 1
      ? { checkedBy: userId, checkedByName: userName, checkedByRole: userRole, checkedAt: new Date() }
      : {}),
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
importsRouter.post('/imports/parse-file', async (req, res, next) => {
  try {
    const {
      fileName = '',
      fileType = '',
      contentBase64 = '',
      base64Data = '',
      fileBase64 = '',
      rawText = '',
      rows = [],
      defaultCategoryId = '',
    } = req.body || {};
    const effectiveBase64 = String(contentBase64 || base64Data || fileBase64 || '');

    const [categories, catalogProducts] = await Promise.all([
      categoryRepo.find({ status: 'ACTIVE' }),
      productRepo.find({}),
    ]);

    const fallbackCatId = defaultCategoryId || categories[0]?._id || '';
    const catByName = new Map(
      categories.map((c) => [
        c.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .trim(),
        c,
      ])
    );
    const catByCode = new Map(categories.map((c) => [String(c.code || '').toUpperCase(), c]));
    const prodByCode = new Map(catalogProducts.map((p) => [String(p.code || '').toUpperCase(), p]));

    let parsedRows: ParsedImportFileRow[] = [];
    const ext = String(fileName || '').toLowerCase();
    const cleanType = String(fileType || '').toUpperCase();
    let detectedFileType = cleanType || 'TEXT';

    if (Array.isArray(rows) && rows.length > 0) {
      detectedFileType = 'EXCEL';
      const matrix: string[][] = [
        ['Loại', 'Hãng', 'Tên sản phẩm', 'Màu sắc', 'Size', 'ĐVT', 'Số lượng', 'Giá gốc', 'Giá bán', 'Ghi chú'],
        ...rows.map((r: any) => [
          String(r.category || r.categoryName || ''),
          String(r.brand || ''),
          String(r.productName || r.name || ''),
          String(r.color || ''),
          String(r.size || ''),
          String(r.unit || 'Cái'),
          String(r.expectedQuantity ?? r.quantity ?? 1),
          String(r.costPrice ?? 0),
          String(r.sellingPrice ?? 0),
          String(r.note || ''),
        ]),
      ];
      parsedRows = convertMatrixToImportRows(matrix);
    } else if (effectiveBase64 && typeof effectiveBase64 === 'string') {
      const cleanB64 = effectiveBase64.replace(/^data:[^;]+;base64,/, '').trim();
      const buffer = Buffer.from(cleanB64, 'base64');

      if (ext.endsWith('.xlsx') || cleanType === 'EXCEL' || cleanType === 'XLSX') {
        detectedFileType = 'XLSX';
        const matrix = parseXlsxBufferToMatrix(buffer);
        parsedRows = convertMatrixToImportRows(matrix);
      } else if (ext.endsWith('.csv') || ext.endsWith('.tsv') || cleanType === 'CSV') {
        detectedFileType = 'CSV';
        const matrix = parseCsvTextToMatrix(buffer.toString('utf8'));
        parsedRows = convertMatrixToImportRows(matrix);
      } else if (ext.endsWith('.pdf') || cleanType === 'PDF') {
        detectedFileType = 'PDF';
        const pdfText = extractTextFromPdfBuffer(buffer);
        parsedRows = parseRawTextToImportRows(pdfText || rawText);
      } else {
        // Thử đọc như XLSX trước, nếu không phải ZIP thì đọc như CSV/Text
        const matrix = parseXlsxBufferToMatrix(buffer);
        if (matrix.length > 0) {
          detectedFileType = 'XLSX';
          parsedRows = convertMatrixToImportRows(matrix);
        } else {
          detectedFileType = 'CSV';
          const textContent = buffer.toString('utf8');
          const csvMatrix = parseCsvTextToMatrix(textContent);
          parsedRows = convertMatrixToImportRows(csvMatrix);
          if (parsedRows.length === 0) {
            parsedRows = parseRawTextToImportRows(textContent);
          }
        }
      }
    } else if (rawText && typeof rawText === 'string') {
      detectedFileType = 'TEXT';
      parsedRows = parseRawTextToImportRows(rawText);
    }

    const finalItems: IImportReceiptItem[] = parsedRows.map((row, index) => {
      let existingProd = prodByCode.get(row.productCode);
      if (!existingProd && row.productName) {
        const lowerName = row.productName.trim().toLowerCase();
        existingProd = catalogProducts.find(
          (p) => String(p.name || '').trim().toLowerCase() === lowerName
        );
      }
      let resolvedCatId = existingProd?.categoryId || fallbackCatId;

      if (row.categoryName) {
        const normCat = row.categoryName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .trim();
        const matchedCat =
          catByCode.get(row.categoryName.toUpperCase()) ||
          catByName.get(normCat) ||
          categories.find((c) =>
            c.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .includes(normCat)
          );
        if (matchedCat) resolvedCatId = String(matchedCat._id);
      }

      const resolvedCat = categories.find((c) => String(c._id) === String(resolvedCatId));
      const finalCode = existingProd?.code
        ? existingProd.code
        : generateProductCode(row.productName, {
            categoryCode: resolvedCat?.code,
            categoryName: resolvedCat?.name || row.categoryName,
            brand: row.brand,
            existingCode: row.productCode,
          });
      const finalVariantCode = generateVariantProductCode(finalCode, row.color, row.size);

      const costPrice =
        row.costPrice > 0 ? row.costPrice : Number(existingProd?.costPrice || 0);
      const sellingPrice =
        row.sellingPrice > 0 ? row.sellingPrice : Number(existingProd?.sellingPrice || 0);

      return {
        stt: index + 1,
        productId: existingProd ? String(existingProd._id) : '',
        productCode: finalCode,
        variantCode: finalVariantCode,
        productName: existingProd ? existingProd.name : row.productName,
        brand: row.brand || existingProd?.brand || '',
        color: row.color || '',
        size: row.size || '',
        categoryId: resolvedCatId,
        unit: row.unit || existingProd?.unit || 'Cái',
        expectedQuantity: row.expectedQuantity,
        actualQuantity: row.actualQuantity,
        costPrice,
        sellingPrice,
        scannedQuantity: row.actualQuantity,
        barcode: finalVariantCode, // Mã vạch trên tem Label in theo Mã con của từng thuộc tính (Màu, Size)
        note: row.note || '',
        isChecked: true,
        isConfirmed: false,
        discrepancyNote: 'Khớp đủ',
      };
    });

    const totalQuantity = finalItems.reduce((sum, i) => sum + (Number(i.actualQuantity) || 0), 0);

    res.json({
      data: {
        fileType: detectedFileType,
        items: finalItems,
        totalRows: finalItems.length,
        totalQuantity,
      },
      meta: {
        fileName,
        fileType: detectedFileType,
        totalExtracted: finalItems.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/imports/ocr-preview
importsRouter.post('/imports/ocr-preview', async (req, res, next) => {
  try {
    const { imageText } = req.body || {};
    const categories = await categoryRepo.find({ status: 'ACTIVE' });
    const defaultCatId = categories[0]?._id || '';
    const extractedItems = rowsToImportItems(parseTextToRows(String(imageText || '')), defaultCatId);

    res.json({
      data: { items: extractedItems },
      meta: { totalExtracted: extractedItems.length },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/imports/ocr-scan
importsRouter.post('/imports/ocr-scan', async (req, res, next) => {
  try {
    const { mode, fileBase64, mimeType } = req.body || {};
    const { data, mime } = validateOcrInput(fileBase64, mimeType);

    if (String(mode).toUpperCase() === 'TAG') {
      const tag = await ocrScanTag(data, mime);
      res.json({ data: tag, meta: {} });
      return;
    }

    const categories = await categoryRepo.find({ status: 'ACTIVE' });
    const defaultCatId = categories[0]?._id || '';
    const result = await ocrScanTable(data, mime);
    const items = rowsToImportItems(result.rows, defaultCatId);

    res.json({
      data: { items, rawText: result.rawText, engine: result.engine },
      meta: { totalExtracted: items.length },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/imports
importsRouter.get('/imports', async (req, res, next) => {
  try {
    await ensureStandardProductCodesMigrated();
    const { status, search } = req.query;
    const [allReceipts, staffRoleMap, productPriceMap] = await Promise.all([
      importReceiptRepo.find({}, { createdAt: -1 }),
      buildStaffRoleMap(),
      buildProductPriceMap(),
    ]);

    const enrichedReceipts = allReceipts.map((r) =>
      enrichReceiptRoles(r, staffRoleMap, productPriceMap)
    );

    const baseFiltered = enrichedReceipts.filter((r) => {
      if (status && r.status !== String(status).toUpperCase()) return false;
      return true;
    });

    const filtered = search
      ? filterAndRankBySearch(baseFiltered, String(search), (r) => [
          { text: r.code, weight: 1.6 },
          { text: r.note, weight: 1.0 },
          { text: r.createdByName, weight: 0.9 },
          { text: r.completedByName, weight: 0.9 },
          ...r.items.flatMap((i: any) => [
            { text: i.variantCode, weight: 1.5 },
            { text: i.productCode, weight: 1.3 },
            { text: i.productName, weight: 1.2 },
            { text: i.color, weight: 0.9 },
            { text: i.size, weight: 0.9 },
            { text: (i as any).barcode, weight: 1.4 },
          ]),
        ])
      : baseFiltered;

    res.json({
      data: filtered,
      meta: { total: filtered.length },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/imports/:id
importsRouter.get('/imports/:id', async (req, res, next) => {
  try {
    const receipt =
      (await importReceiptRepo.findById(req.params.id)) ||
      (await importReceiptRepo.findOne({ code: req.params.id.toUpperCase() }));
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }

    const [staffRoleMap, productPriceMap] = await Promise.all([
      buildStaffRoleMap(),
      buildProductPriceMap(),
    ]);
    const enriched = enrichReceiptRoles(receipt, staffRoleMap, productPriceMap);

    const totalLines = enriched.items.length;
    const checkedLines = enriched.items.filter((i: any) => i.isChecked).length;
    const confirmedLines = enriched.items.filter((i: any) => i.isConfirmed).length;

    res.json({
      data: enriched,
      meta: {
        totalLines,
        checkedLines,
        confirmedLines,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/imports
importsRouter.post('/imports', async (req, res, next) => {
  try {
    const { note, defaultCategoryId, items, status, targetWarehouse } = req.body || {};
    const categories = await categoryRepo.find({ status: 'ACTIVE' });
    const fallbackCatId = defaultCategoryId || categories[0]?._id || '';

    const normalizedItems = normalizeImportItems(items || [], fallbackCatId, categories);

    const count = await importReceiptRepo.countDocuments({});
    const code = `PN-${String(count + 1).padStart(4, '0')}`;

    const initialStatus = status === 'CHECKING' ? 'CHECKING' : 'DRAFT';
    const warehouseFloor = normalizeFloor(targetWarehouse);
    const createdBy = req.user?.userId || 'WAREHOUSE';
    const createdByName = req.user?.fullName || 'Thủ kho';
    const createdByRole = inferRole(req.user?.role, createdBy, createdByName);

    const created = await importReceiptRepo.create({
      code,
      status: initialStatus,
      targetWarehouse: warehouseFloor,
      defaultCategoryId: fallbackCatId,
      note: note ? String(note).trim() : '',
      items: normalizedItems,
      createdBy,
      createdByName,
      createdByRole,
    });

    res.status(201).json({
      data: created,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/imports/:id
importsRouter.put('/imports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const receipt = await importReceiptRepo.findById(id);
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }

    if (receipt.status === 'COMPLETED') {
      throw new ApiError(
        400,
        'IMPORT_RECEIPT_LOCKED',
        'Phiếu nhập đã hoàn thành (COMPLETED), không được phép chỉnh sửa trực tiếp'
      );
    }

    const { note, defaultCategoryId, items, status, targetWarehouse } = req.body || {};
    const updateData: Record<string, any> = {};

    if (note !== undefined) updateData.note = String(note).trim();
    if (defaultCategoryId !== undefined) updateData.defaultCategoryId = String(defaultCategoryId);
    if (targetWarehouse !== undefined) updateData.targetWarehouse = normalizeFloor(targetWarehouse);
    if (items !== undefined) {
      const categories = await categoryRepo.find({});
      updateData.items = keepCheckerFields(
        normalizeImportItems(items, defaultCategoryId || receipt.defaultCategoryId, categories),
        receipt.items
      );
    }
    if (status && ['DRAFT', 'CHECKING'].includes(status)) {
      updateData.status = status;
    }

    const updated = await importReceiptRepo.updateById(id, updateData);
    res.json({
      data: updated,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/imports/:id/finish-listing
importsRouter.post('/imports/:id/finish-listing', async (req, res, next) => {
  try {
    const { id } = req.params;
    const receipt = await importReceiptRepo.findById(id);
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }

    if (receipt.status === 'COMPLETED') {
      throw new ApiError(400, 'IMPORT_RECEIPT_LOCKED', 'Phiếu nhập đã hoàn thành');
    }

    const categories = await categoryRepo.find({});
    const itemsToSave = req.body?.items
      ? keepCheckerFields(
          normalizeImportItems(req.body.items, receipt.defaultCategoryId, categories),
          receipt.items
        )
      : receipt.items;

    if (itemsToSave.length === 0) {
      throw new ApiError(
        400,
        'EMPTY_IMPORT_ITEMS',
        'Phiếu nhập cần ít nhất 1 dòng hàng trước khi chuyển sang bước kiểm thực tế'
      );
    }

    const updated = await importReceiptRepo.updateById(id, {
      status: 'CHECKING',
      items: itemsToSave,
    });

    res.json({
      data: updated,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/imports/:id
importsRouter.delete('/imports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const receipt = await importReceiptRepo.findById(id);
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }

    if (receipt.status === 'COMPLETED') {
      if (req.user?.role !== 'ADMIN') {
        throw new ApiError(
          400,
          'IMPORT_RECEIPT_LOCKED',
          'Phiếu nhập đã hoàn thành và bị khóa; chỉ Quản lý/Admin mới có quyền xóa'
        );
      }
      const movements = await stockMovementRepo.find({ referenceId: String(receipt._id) });
      for (const m of movements) {
        const prod = await productRepo.findById(String(m.productId));
        if (prod) {
          const floor = normalizeFloor(m.warehouseLocation || receipt.targetWarehouse);
          const nextFloors = applyFloorDelta(
            prod,
            floor,
            -(Number(m.quantityChange) || 0),
            m.color,
            m.size
          );
          await productRepo.updateById(prod._id, nextFloors);
        }
        await stockMovementRepo.deleteById(m._id);
      }
    }

    await importReceiptRepo.deleteById(receipt._id);

    res.json({
      data: {
        deleted: true,
        _id: receipt._id,
        code: receipt.code,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/imports/:id/scan-check
importsRouter.post('/imports/:id/scan-check', async (req, res, next) => {
  try {
    const { id } = req.params;
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

    const { query, productCode, productName, barcode, codes, rawText, rowIndex } = req.body || {};
    const delta: 1 | -1 = Number(req.body?.delta) === -1 ? -1 : 1;
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
          res.json({
            data: {
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
            },
            meta: {},
          });
          return;
        }
        matchedIndex = result.index;
      }
    }

    if (matchedIndex === null) {
      res.json({
        data: {
          matched: false,
          warning: `Tag "${label}" KHÔNG có trong danh sách kiểm hàng. Hàng này không được tự thêm vào phiếu.`,
          progress: progressOfItems(items),
          receipt,
        },
        meta: {},
      });
      return;
    }

    const applied = await applyMatchedScan({
      id,
      receipt,
      items,
      matchedIndex,
      delta,
      explicitActualQuantity:
        req.body?.actualQuantity !== undefined ? Number(req.body.actualQuantity) : undefined,
      user: req.user,
      learnedBarcode: cleanBarcode,
    });

    res.json({ data: applied, meta: {} });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/imports/:id/scan-tag
importsRouter.post('/imports/:id/scan-tag', async (req, res, next) => {
  const startedAt = Date.now();
  let ocrMs = 0;
  const finishWithTiming = (payload: Record<string, any>) => {
    const totalMs = Date.now() - startedAt;
    res.setHeader('Server-Timing', `ocr;dur=${ocrMs}, total;dur=${totalMs}`);
    res.json({
      data: {
        ...payload,
        timing: { ocrMs, totalMs },
      },
      meta: {},
    });
  };

  try {
    const { id } = req.params;
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

    const { fileBase64, mimeType, barcode: rawBarcode } = req.body || {};
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
          user: req.user,
          learnedBarcode: clientBarcode,
        });
        finishWithTiming({
          ...applied,
          source: 'barcode',
          barcode: clientBarcode,
          ocr: null,
        });
        return;
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
            user: req.user,
            learnedBarcode: clientBarcode,
          });
          finishWithTiming({
            ...applied,
            source: 'barcode',
            barcode: clientBarcode,
            ocr: null,
          });
          return;
        }
        finishWithTiming({
          matched: false,
          source: 'barcode',
          barcode: clientBarcode,
          ocr: null,
          warning: `Mã vạch "${clientBarcode}" chưa khớp dòng nào trong danh sách kiểm hàng.`,
          progress: progressOfItems(items),
          receipt,
        });
        return;
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
      finishWithTiming({
        matched: false,
        unreadable: true,
        source: 'ocr',
        barcode: '',
        ocr: ocrSummary,
        warning: 'Không đọc được tag. Đưa tag gần hơn, đủ sáng, chụp thẳng rồi thử lại.',
        progress: progressOfItems(items),
        receipt,
      });
      return;
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
        finishWithTiming({
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
        return;
      }
      matchedIndex = result.index;
    }

    if (matchedIndex === null) {
      const label = tag.productName || tag.productCode || finalBarcode;
      finishWithTiming({
        matched: false,
        source: 'ocr',
        barcode: finalBarcode,
        ocr: ocrSummary,
        warning: `Tag "${label}" KHÔNG có trong danh sách kiểm hàng. Hàng này không được tự thêm vào phiếu.`,
        progress: progressOfItems(items),
        receipt,
      });
      return;
    }

    const applied = await applyMatchedScan({
      id,
      receipt,
      items,
      matchedIndex,
      delta: 1,
      user: req.user,
      learnedBarcode: finalBarcode,
    });

    finishWithTiming({
      ...applied,
      source: 'ocr',
      barcode: finalBarcode,
      ocr: ocrSummary,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/imports/:id/complete (Hoàn thành nhập kho — cộng dồn biến thể Size/Màu kèm Mã con variantCode vào Mã sản phẩm chung)
importsRouter.post('/imports/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params;
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

    const categories = await categoryRepo.find({});
    const defaultCategory =
      categories.find((c) => String(c._id) === String(receipt.defaultCategoryId)) ||
      categories[0];

    const finalItems = req.body?.items
      ? keepCheckerFields(
          normalizeImportItems(req.body.items, receipt.defaultCategoryId, categories),
          receipt.items
        )
      : receipt.items;

    const confirmedItems = finalItems.filter((i) => i.isConfirmed);
    if (confirmedItems.length === 0) {
      throw new ApiError(
        400,
        'NO_CONFIRMED_ITEMS',
        'Vui lòng tick xác nhận ít nhất 1 dòng hàng đã kiểm trước khi bấm Hoàn thành nhập kho'
      );
    }

    const targetFloor = normalizeFloor(req.body?.targetWarehouse || receipt.targetWarehouse);
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

      let code =
        (item.productCode && isStandardSixDigitProductCode(item.productCode)
          ? item.productCode
          : '') ||
        extracted.code ||
        generateProductCode(cleanBaseName, {
          categoryCode: itemCat?.code,
          categoryName: itemCat?.name,
          brand: item.brand || extracted.brand,
        });
      let product = await productRepo.findOne({ code });
      if (
        product &&
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

      const childVariantCode = generateVariantProductCode(code, itemColor, itemSize);
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
      const nextFloors = applyFloorDelta(product, targetFloor, qtyToAdd, itemColor, itemSize);
      const balanceAfter = nextFloors.stock;

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

      await productRepo.updateById(product._id, productUpdate);

      const actorId = req.user?.userId || receipt.createdBy || 'WAREHOUSE';
      const actorName = req.user?.fullName || receipt.createdByName || 'Thủ kho';
      const actorRole = inferRole(req.user?.role || receipt.createdByRole, actorId, actorName);

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
        variantCode: childVariantCode,
        color: itemColor,
        size: itemSize,
        barcode: itemBarcode,
      });
    }

    const completedBy = req.user?.userId || 'WAREHOUSE';
    const completedByName = req.user?.fullName || 'Thủ kho';
    const completedByRole = inferRole(req.user?.role, completedBy, completedByName);

    const completedReceipt = await importReceiptRepo.updateById(id, {
      status: 'COMPLETED',
      targetWarehouse: targetFloor,
      items: updatedItems,
      completedBy,
      completedByName,
      completedByRole,
      completedAt: new Date(),
    });

    res.json({
      data: {
        receipt: completedReceipt,
        movements: createdMovements,
      },
      meta: {
        confirmedCount: confirmedItems.length,
        totalItems: updatedItems.length,
      },
    });
  } catch (err) {
    next(err);
  }
});
