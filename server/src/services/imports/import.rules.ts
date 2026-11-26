import type { IImportReceiptItem } from "../../models/ImportReceipt";
import { sanitizeBarcode, type OcrTableRow } from "../../infra/ocr";
import { ImportSchemeContext, findCodeConflictsInList, findExistingProductForImport, proposeImportProduct, resolveExplicitImportSchemeItem, resolveImportColorCode } from "../catalog";
import { ApiError } from "../../shared/errors";
import {
  buildVariantKey,
  extractVariantFromText,
  generateProductCode,
  isStandardSixDigitProductCode,
  buildVariantSku,
  generateVariantProductCode,
  isNewSchemeProduct,
  normalizeToCompactUpperCode,
} from "../../shared/productCode";
import { sanitizeColorHexes } from "../inventory";

export function inferRole(
  explicitRole?: string,
  userId?: string,
  userName?: string,
  staffRoleMap?: Map<string, string>
): string {
  const cleanRole = String(explicitRole || '').trim().toUpperCase();
  if (cleanRole === 'CEO' || cleanRole === 'ADMIN' || cleanRole === 'ACCOUNTANT' || cleanRole === 'HR' || cleanRole === 'MARKETING' || cleanRole === 'SALES') {
    return cleanRole;
  }
  const uid = String(userId || '').trim();
  if (uid && staffRoleMap?.has(uid)) {
    return staffRoleMap.get(uid)!;
  }
  const upperId = uid.toUpperCase();
  if (upperId === 'ADMIN') return 'ADMIN';
  if (upperId === 'ACCOUNTANT') return 'ACCOUNTANT';
  const nameLower = String(userName || '').toLowerCase();
  if (nameLower.includes('admin') || nameLower.includes('quản trị') || nameLower.includes('quản lý')) {
    return 'ADMIN';
  }
  return 'ACCOUNTANT';
}


export function enrichReceiptRoles(
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
          ? isStandardSixDigitProductCode(it.productCode)
            ? generateVariantProductCode(it.productCode || '', it.color || '', it.size || '')
            : it.variantCode || buildVariantSku(it.productCode || '', it.colorCode || '', it.size || '')
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

export function inferReceiptActorRole(
  explicitRole?: string,
  userId?: string,
  userName?: string,
  staffRoleMap?: Map<string, string>
): string {
  return inferRole(explicitRole, userId, userName, staffRoleMap);
}

// Giá gốc (đơn giá nhập) do thủ kho nhập — số nguyên VND >= 0
export function parseCostPrice(raw: any, stt: number): number {
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
export function parseSellingPrice(raw: any, stt: number): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const value = Math.round(Number(raw));
  if (isNaN(value) || value < 0) {
    throw new ApiError(400, 'INVALID_SELLING_PRICE', `Giá bán dòng #${stt} phải là số nguyên không âm`, {
      sellingPrice: 'Giá bán không hợp lệ',
    });
  }
  return value;
}

export function normalizeImportItems(
  rawItems: any[],
  defaultCategoryId = '',
  categories: any[] = [],
  ctx?: ImportSchemeContext
): IImportReceiptItem[] {
  if (!Array.isArray(rawItems)) return [];
  const catMap = new Map(categories.map((c) => [String(c._id), c]));
  return rawItems
    .filter((item) => item && (item.productName || item.productCode || item.versionName || item.versionCode))
    .map((item, idx) => {
      const resolvedCatId = item.categoryId ? String(item.categoryId) : defaultCategoryId;
      const cat = catMap.get(String(resolvedCatId));
      const rawName = String(item.productName || item.versionName || item.productCode || '').trim();
      const extracted = extractVariantFromText(rawName, {
        categoryCode: cat?.code,
        categoryName: cat?.name,
        brand: item.brand ? String(item.brand).trim() : '',
        existingCode: item.productCode ? String(item.productCode) : '',
      });
      const color = item.color !== undefined ? String(item.color).trim() : extracted.color;
      const size =
        item.size !== undefined ? String(item.size).trim().toUpperCase() : extracted.size;
      let brand = item.brand !== undefined ? String(item.brand).trim() : extracted.brand;
      let brandId = item.brandId ? String(item.brandId).trim() : '';
      let versionName = item.versionName ? String(item.versionName).trim() : '';
      let versionCode = item.versionCode ? String(item.versionCode).trim().toUpperCase() : '';
      let productName =
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
      let productCode =
        explicitCleanCode && isStandardSixDigitProductCode(explicitCleanCode)
          ? explicitCleanCode
          : autoCode || explicitCleanCode;
      let variantCode = generateVariantProductCode(productCode, color, size);
      let productId = item.productId ? String(item.productId) : '';
      let colorCode = item.colorCode ? String(item.colorCode).trim().toUpperCase() : '';
      const hasExplicitScheme = Boolean(brandId && (versionCode || versionName));

      // v5.0: dòng hàng khớp CHÍNH XÁC sản phẩm có sẵn (productId / mã gốc / mã con / mã cũ) => giữ đúng mã sản phẩm đó;
      // nếu dòng truyền brandId + (versionCode | versionName) => sinh mã theo scheme mới chính xác từ các trường đó (không đoán từ tên);
      // sản phẩm chưa có và không truyền brandId => đề xuất mã theo quy chuẩn mới (Cate + Brand + Version), không khớp mờ theo tên.
      if (ctx) {
        let target = productId
          ? findExistingProductForImport({ productId }, ctx.products)
          : !hasExplicitScheme
          ? findExistingProductForImport({ productId, productCode: item.productCode }, ctx.products)
          : null;
        let proposedCode = '';
        const explicitLegacy = Boolean(explicitCleanCode && isStandardSixDigitProductCode(explicitCleanCode));
        if (!target && hasExplicitScheme) {
          const explicitProposal = resolveExplicitImportSchemeItem(ctx, {
            categoryId: resolvedCatId,
            brandId,
            versionName,
            versionCode,
            color,
            colorCode: item.colorCode,
            size,
          });
          brand = explicitProposal.brand.isSystem ? '' : explicitProposal.brand.name;
          brandId = String(explicitProposal.brand._id || brandId);
          versionName = explicitProposal.versionName;
          versionCode = explicitProposal.versionCode;
          colorCode = explicitProposal.colorCode;
          variantCode = explicitProposal.variantCode;
          if (!String(item.productName || '').trim()) {
            productName = `${brand ? brand + ' ' : ''}${versionName}`.trim();
          }
          if (explicitProposal.existing) {
            target = explicitProposal.existing;
            productId = String(target._id);
            productCode = target.code;
          } else {
            productId = '';
            productCode = explicitProposal.code;
          }
        } else {
          if (!target && !explicitLegacy) {
            const proposal = proposeImportProduct(ctx, {
              name: extracted.baseName || productName,
              brand,
              categoryId: resolvedCatId,
            });
            if (proposal?.existing) target = proposal.existing;
            else if (proposal) proposedCode = proposal.code;
          }
          if (target) {
            productId = String(target._id);
            productCode = target.code;
            if (target.brandId) brandId = String(target.brandId);
            if (target.versionName) versionName = String(target.versionName);
            if (target.versionCode) versionCode = String(target.versionCode);
            if (isNewSchemeProduct(target)) {
              colorCode = resolveImportColorCode(ctx, target.code, target.variants || [], color, item.colorCode);
              variantCode = buildVariantSku(target.code, colorCode, size);
              const conflicts = findCodeConflictsInList(ctx.products, [variantCode], String(target._id));
              if (conflicts.length > 0) {
                throw new ApiError(
                  409,
                  'CODE_CONFLICT',
                  `Mã ${conflicts[0].code} đã được dùng bởi sản phẩm ${conflicts[0].productCode}`,
                  { code: conflicts[0].code, conflictProductId: conflicts[0].productId }
                );
              }
            } else {
              variantCode = generateVariantProductCode(target.code, color, size);
            }
          } else if (proposedCode) {
            productId = '';
            productCode = proposedCode;
            colorCode = resolveImportColorCode(ctx, proposedCode, [], color, item.colorCode);
            variantCode = buildVariantSku(proposedCode, colorCode, size);
          }
        }
      }
      const expectedQuantity = Math.max(0, Math.round(Number(item.expectedQuantity ?? item.quantity ?? 0)));
      const actualQuantity =
        item.actualQuantity !== undefined
          ? Math.max(0, Math.round(Number(item.actualQuantity)))
          : expectedQuantity;

      const customBarcode = item.barcode ? sanitizeBarcode(item.barcode) : '';
      const finalBarcode =
        customBarcode && customBarcode !== productCode ? customBarcode : variantCode || productCode;

      const incomingScanCounts = Array.isArray(item.scanCounts)
        ? item.scanCounts
            .filter((s: any) => s && Number(s.quantity) > 0)
            .map((s: any) => ({
              userId: String(s.userId || ''),
              name: String(s.name || ''),
              role: String(s.role || ''),
              quantity: Math.max(0, Math.round(Number(s.quantity) || 0)),
            }))
        : [];

      return {
        stt: Number(item.stt) || idx + 1,
        productId,
        productCode,
        variantCode,
        productName,
        brand,
        brandId,
        versionName,
        versionCode,
        color,
        colorCode,
        colorHexes: sanitizeColorHexes(item.colorHexes),
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
        ...(item.checkedBy ? { checkedBy: String(item.checkedBy) } : {}),
        ...(item.checkedByName ? { checkedByName: String(item.checkedByName) } : {}),
        ...(item.checkedByRole ? { checkedByRole: String(item.checkedByRole) } : {}),
        ...(item.checkedAt ? { checkedAt: new Date(item.checkedAt) } : {}),
        ...(incomingScanCounts.length > 0 ? { scanCounts: incomingScanCounts } : {}),
      };
    });
}

export function keepCheckerFields(newItems: IImportReceiptItem[], oldItems: IImportReceiptItem[]): IImportReceiptItem[] {
  const used = new Set<number>();
  return newItems.map((item, idx) => {
    const matchSameRow = (o: IImportReceiptItem) =>
      ((o.productId && item.productId && String(o.productId) === String(item.productId)) ||
        o.productCode === item.productCode) &&
      buildVariantKey(o.color, o.size) === buildVariantKey(item.color, item.size);

    let oi = oldItems[idx] && matchSameRow(oldItems[idx]) && !used.has(idx) ? idx : -1;
    if (oi < 0) oi = oldItems.findIndex((o, j) => !used.has(j) && matchSameRow(o));
    if (oi < 0 && oldItems.length === newItems.length && oldItems[idx] && !used.has(idx)) {
      oi = idx;
    }
    if (oi < 0) {
      oi = oldItems.findIndex(
        (o, j) =>
          !used.has(j) &&
          ((o.productId && item.productId && String(o.productId) === String(item.productId)) ||
            o.productCode === item.productCode)
      );
    }
    if (oi < 0) {
      return {
        ...item,
        checkedBy: item.checkedBy || '',
        checkedByName: item.checkedByName || '',
        checkedByRole: item.checkedByRole || '',
        checkedAt: item.checkedAt,
        scanCounts: Array.isArray(item.scanCounts) ? item.scanCounts.map((s) => ({ ...s })) : [],
        barcode: item.barcode || item.variantCode || item.productCode || '',
      };
    }
    used.add(oi);
    const old = oldItems[oi];
    const preservedScanCounts =
      Array.isArray(old.scanCounts) && old.scanCounts.length > 0
        ? old.scanCounts.map((s) => ({ ...s }))
        : Array.isArray(item.scanCounts)
        ? item.scanCounts.map((s) => ({ ...s }))
        : [];
    return {
      ...item,
      colorHexes:
        item.colorHexes && item.colorHexes.length > 0
          ? item.colorHexes
          : sanitizeColorHexes(old.colorHexes),
      barcode: item.variantCode || old.barcode || item.barcode || '',
      checkedBy: old.checkedBy || item.checkedBy || '',
      checkedByName: old.checkedByName || item.checkedByName || '',
      checkedByRole: old.checkedByRole || item.checkedByRole || '',
      checkedAt: old.checkedAt || item.checkedAt,
      scanCounts: preservedScanCounts,
    };
  });
}

export function rowsToImportItems(rows: OcrTableRow[], defaultCatId: string): IImportReceiptItem[] {
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

export const isFullItem = (it: IImportReceiptItem) =>
  (Number(it.scannedQuantity) || 0) >= Math.max(1, Number(it.expectedQuantity) || 0);

export const progressOfItems = (list: IImportReceiptItem[]) => ({
  checked: list.filter(isFullItem).length,
  total: list.length,
  scannedUnits: list.reduce((s, i) => s + (Number(i.scannedQuantity) || 0), 0),
  expectedUnits: list.reduce((s, i) => s + (Number(i.expectedQuantity) || 0), 0),
});

