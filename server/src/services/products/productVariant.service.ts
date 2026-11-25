import { productRepo, stockMovementRepo } from "../../repositories";
import { findCodeConflicts, prepareSchemeVariants } from "../catalog";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { created, ok, ServiceResult } from "../../shared/result";
import {
  buildVariantKey,
  generateVariantProductCode,
  isNewSchemeProduct,
  normalizeToCompactUpperCode,
} from "../../shared/productCode";
import {
  floorLabel,
  formatProductWithVariant,
  getFloorStocks,
  inferActorRole,
  normalizeFloor,
  normalizeVariants,
  sanitizeColorHexes,
  summarizeVariants,
} from "../inventory";
import {
  assertPricePermission,
  canEditSellingPrice,
  isPriceManager,
  parseMoneyField,
  presentVariants,
} from "./product.rules";

export async function buildPatchedVariantsForProduct(
  product: any,
  currentVariants: any[],
  rawPatches: any[],
  options: { partial: boolean; role?: string }
) {
  const newScheme = isNewSchemeProduct(product);
  const norm = (val: any) => normalizeToCompactUpperCode(String(val || ''));
  const usedCurrentIndices = new Set<number>();
  const matchedCurrentIndexByPatch = new Map<number, number>();

  // Pass 1: khớp chính xác theo mã cũ/mới hoặc khoá biến thể
  rawPatches.forEach((rv, pIdx) => {
    const explicitCode = norm(rv?.fromVariantCode || rv?.oldVariantCode || rv?.targetVariantCode);
    if (explicitCode) {
      const i = currentVariants.findIndex(
        (v, idx) =>
          !usedCurrentIndices.has(idx) &&
          (norm(v.variantCode) === explicitCode ||
            norm(v.legacyVariantCode) === explicitCode ||
            (v.legacyVariantCodes || []).some((c: any) => norm(c) === explicitCode))
      );
      if (i >= 0) {
        usedCurrentIndices.add(i);
        matchedCurrentIndexByPatch.set(pIdx, i);
        return;
      }
    }
    const explicitKey = String(rv?.fromVariantKey || rv?.oldVariantKey || rv?.targetVariantKey || '').trim();
    if (explicitKey) {
      const i = currentVariants.findIndex((v, idx) => !usedCurrentIndices.has(idx) && v.variantKey === explicitKey);
      if (i >= 0) {
        usedCurrentIndices.add(i);
        matchedCurrentIndexByPatch.set(pIdx, i);
        return;
      }
    }
    const vc = norm(rv?.variantCode);
    if (vc) {
      const i = currentVariants.findIndex(
        (v, idx) =>
          !usedCurrentIndices.has(idx) &&
          (norm(v.variantCode) === vc ||
            norm(v.legacyVariantCode) === vc ||
            (v.legacyVariantCodes || []).some((c: any) => norm(c) === vc))
      );
      if (i >= 0) {
        usedCurrentIndices.add(i);
        matchedCurrentIndexByPatch.set(pIdx, i);
        return;
      }
    }
    const vk = String(rv?.variantKey || '').trim();
    if (vk) {
      const i = currentVariants.findIndex((v, idx) => !usedCurrentIndices.has(idx) && v.variantKey === vk);
      if (i >= 0) {
        usedCurrentIndices.add(i);
        matchedCurrentIndexByPatch.set(pIdx, i);
        return;
      }
    }
    if (rv?.color !== undefined || rv?.size !== undefined) {
      const csKey = buildVariantKey(rv?.color, rv?.size);
      const i = currentVariants.findIndex((v, idx) => !usedCurrentIndices.has(idx) && v.variantKey === csKey);
      if (i >= 0) {
        usedCurrentIndices.add(i);
        matchedCurrentIndexByPatch.set(pIdx, i);
      }
    }
  });

  // Pass 2: nếu gửi toàn bộ danh sách có cùng độ dài, khớp theo vị trí cho phần tử vừa sửa cả color/size
  if (rawPatches.length === currentVariants.length) {
    rawPatches.forEach((_rv, pIdx) => {
      if (!matchedCurrentIndexByPatch.has(pIdx) && !usedCurrentIndices.has(pIdx)) {
        usedCurrentIndices.add(pIdx);
        matchedCurrentIndexByPatch.set(pIdx, pIdx);
      }
    });
  }

  if (options.partial) {
    for (let pIdx = 0; pIdx < rawPatches.length; pIdx++) {
      if (!matchedCurrentIndexByPatch.has(pIdx)) {
        const rv = rawPatches[pIdx];
        throw new ApiError(
          404,
          'VARIANT_NOT_FOUND',
          `Không tìm thấy biến thể cần cập nhật (${rv?.variantCode || rv?.fromVariantCode || rv?.variantKey || rv?.fromVariantKey || `${rv?.color || ''}/${rv?.size || ''}`})`
        );
      }
    }
  }

  // Xây dựng danh sách biến thể sau khi áp dụng bản vá
  const explicitColorCodeByColorKey = new Map<string, string>();
  const working: any[] = options.partial
    ? currentVariants.map((v) => ({ ...v, _prevVariantCode: v.variantCode, _hasExplicitCC: false }))
    : [];

  const applyPatchToPrev = (prev: any | undefined, rv: any) => {
    const nextColor =
      rv?.color !== undefined ? String(rv.color || '').trim() : String(prev?.color || '').trim();
    const nextSize =
      rv?.size !== undefined
        ? String(rv.size || '').trim().toUpperCase()
        : String(prev?.size || '').trim().toUpperCase();
    const colorChanged = prev ? norm(nextColor) !== norm(prev.color) : true;
    const rawExplicitCC =
      rv?.colorCode !== undefined && String(rv.colorCode || '').trim()
        ? String(rv.colorCode).trim().toUpperCase()
        : '';
    // Nếu đổi tên màu mà client vẫn gửi lại đúng colorCode cũ của màu trước đó (do form giữ state cũ),
    // chỉ coi là explicit nếu người dùng thực sự truyền colorCode mới hoặc giữ nguyên màu.
    const hasExplicitCC = Boolean(rawExplicitCC);
    const ck = norm(nextColor);
    if (ck && hasExplicitCC && !explicitColorCodeByColorKey.has(ck)) {
      explicitColorCodeByColorKey.set(ck, rawExplicitCC);
    }
    const inheritedCC = !colorChanged && prev?.colorCode ? String(prev.colorCode).toUpperCase() : '';

    let f1 = prev ? prev.stockFloor1 : 0;
    let f2 = prev ? prev.stockFloor2 : 0;
    if (rv?.stockFloor1 !== undefined) f1 = Math.max(0, Math.round(Number(rv.stockFloor1) || 0));
    if (rv?.stockFloor2 !== undefined) f2 = Math.max(0, Math.round(Number(rv.stockFloor2) || 0));
    if (rv?.stockFloor1 === undefined && rv?.stockFloor2 === undefined && rv?.stock !== undefined && !prev) {
      f1 = Math.max(0, Math.round(Number(rv.stock) || 0));
    }

    const vSelling =
      rv?.sellingPrice !== undefined
        ? parseMoneyField(rv.sellingPrice, 'sellingPrice', 'INVALID_PRICE', 'Giá bán biến thể')
        : prev?.sellingPrice;
    const vCost =
      rv?.costPrice !== undefined
        ? parseMoneyField(rv.costPrice, 'costPrice', 'INVALID_COST_PRICE', 'Giá gốc biến thể')
        : prev?.costPrice;
    if (vSelling !== undefined && prev && vSelling !== (prev.sellingPrice || 0) && !canEditSellingPrice(options.role)) {
      throw new ApiError(403, 'SELLING_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin hoặc Thủ kho mới được cập nhật giá bán');
    }
    if (vCost !== undefined && prev && vCost !== (prev.costPrice || 0) && !isPriceManager(options.role)) {
      throw new ApiError(403, 'COST_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được sửa giá gốc');
    }

    const colorHexes =
      Array.isArray(rv?.colorHexes) && rv.colorHexes.length > 0
        ? sanitizeColorHexes(rv.colorHexes)
        : prev?.colorHexes || [];

    return {
      color: nextColor,
      size: nextSize,
      colorCode: hasExplicitCC ? rawExplicitCC : inheritedCC,
      _hasExplicitCC: hasExplicitCC,
      _prevVariantCode: prev?.variantCode || '',
      colorHexes,
      ...(vSelling !== undefined ? { sellingPrice: vSelling } : {}),
      ...(vCost !== undefined ? { costPrice: vCost } : {}),
      ...(prev?.legacyVariantCode ? { legacyVariantCode: prev.legacyVariantCode } : {}),
      ...(Array.isArray(prev?.legacyVariantCodes) && prev.legacyVariantCodes.length > 0
        ? { legacyVariantCodes: [...prev.legacyVariantCodes] }
        : {}),
      stockFloor1: f1,
      stockFloor2: f2,
      stock: f1 + f2,
    };
  };

  if (options.partial) {
    rawPatches.forEach((rv, pIdx) => {
      const targetIdx = matchedCurrentIndexByPatch.get(pIdx)!;
      working[targetIdx] = applyPatchToPrev(currentVariants[targetIdx], rv);
    });
  } else {
    rawPatches.forEach((rv, pIdx) => {
      const targetIdx = matchedCurrentIndexByPatch.get(pIdx);
      const prev = targetIdx !== undefined ? currentVariants[targetIdx] : undefined;
      working.push(applyPatchToPrev(prev, rv));
    });
  }

  // Đồng bộ colorCode mới cho các biến thể cùng màu không truyền colorCode riêng trong request
  for (const item of working) {
    const ck = norm(item.color);
    if (ck && !item._hasExplicitCC && explicitColorCodeByColorKey.has(ck)) {
      item.colorCode = explicitColorCodeByColorKey.get(ck)!;
    }
  }

  let finalVariants: any[];
  if (newScheme) {
    const prepared = prepareSchemeVariants(product.code, working, []);
    finalVariants = prepared.map((v) => {
      const prevCode = String(v._prevVariantCode || '').trim().toUpperCase();
      const nextCode = v.variantCode;
      let legacyVariantCode = v.legacyVariantCode ? String(v.legacyVariantCode).trim().toUpperCase() : undefined;
      const legacySet = new Set<string>(
        Array.isArray(v.legacyVariantCodes)
          ? v.legacyVariantCodes.map((c: any) => String(c || '').trim().toUpperCase()).filter(Boolean)
          : []
      );
      if (prevCode && norm(prevCode) !== norm(nextCode)) {
        if (!legacyVariantCode) {
          legacyVariantCode = prevCode;
        }
        legacySet.add(prevCode);
      }
      const legacyVariantCodes = Array.from(legacySet);
      const { _prevVariantCode, _hasExplicitCC, sizeCode, ...rest } = v;
      return {
        ...rest,
        variantKey: v.variantKey,
        color: v.color,
        ...(v.colorCode ? { colorCode: v.colorCode } : {}),
        size: v.size,
        variantCode: nextCode,
        barcode: nextCode,
        ...(legacyVariantCode ? { legacyVariantCode } : {}),
        ...(legacyVariantCodes.length > 0 ? { legacyVariantCodes } : {}),
      };
    });
    const conflicts = await findCodeConflicts(
      finalVariants.map((v) => v.variantCode),
      String(product._id)
    );
    if (conflicts.length > 0) {
      throw new ApiError(
        409,
        'CODE_CONFLICT',
        `Mã ${conflicts[0].code} đã được dùng bởi sản phẩm ${conflicts[0].productCode}`,
        { code: conflicts[0].code, conflictProductId: conflicts[0].productId }
      );
    }
  } else {
    finalVariants = working.map((v) => {
      const prevCode = String(v._prevVariantCode || '').trim().toUpperCase();
      const nextCode = generateVariantProductCode(product.code, v.color, v.size);
      let legacyVariantCode = v.legacyVariantCode ? String(v.legacyVariantCode).trim().toUpperCase() : undefined;
      const legacySet = new Set<string>(
        Array.isArray(v.legacyVariantCodes)
          ? v.legacyVariantCodes.map((c: any) => String(c || '').trim().toUpperCase()).filter(Boolean)
          : []
      );
      if (prevCode && norm(prevCode) !== norm(nextCode)) {
        if (!legacyVariantCode) legacyVariantCode = prevCode;
        legacySet.add(prevCode);
      }
      const legacyVariantCodes = Array.from(legacySet);
      const { _prevVariantCode, _hasExplicitCC, ...rest } = v;
      return {
        ...rest,
        variantKey: buildVariantKey(v.color, v.size),
        variantCode: nextCode,
        barcode: nextCode,
        ...(legacyVariantCode ? { legacyVariantCode } : {}),
        ...(legacyVariantCodes.length > 0 ? { legacyVariantCodes } : {}),
      };
    });
  }

  return summarizeVariants(finalVariants, product.code, { newScheme });
}

// PATCH /api/v1/products/:id/variants (v5.0) — sửa color / size / colorCode / giá của biến thể

// PATCH /api/v1/products/:id

// DELETE /api/v1/products/:id

// GET /api/v1/inventory/movements

// GET /api/v1/inventory/report

// POST /api/v1/inventory/adjustments

// POST /api/v1/inventory/unpack-set

// GET /api/v1/inventory/transfers

// POST /api/v1/inventory/transfers


export async function addProductVariant(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  if (!isPriceManager(ctx.user?.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản lý/Admin/Kế toán kho mới được thêm biến thể');
    }
    const product = await productRepo.findById(id);
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm');
    const raw: any[] = Array.isArray(body?.variants) ? body.variants : [];
    if (raw.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Danh sách biến thể trống', { variants: 'Bắt buộc' });
    }
    const defaultFloor = normalizeFloor(body?.targetWarehouse);
    const parseVariantStock = (v: any) => {
      const vFloor = normalizeFloor(v?.targetWarehouse ?? defaultFloor);
      const rawQ = v?.quantity !== undefined ? Math.round(Number(v.quantity)) : 0;
      const rawF1 = v?.stockFloor1 !== undefined ? Math.round(Number(v.stockFloor1)) : undefined;
      const rawF2 = v?.stockFloor2 !== undefined ? Math.round(Number(v.stockFloor2)) : undefined;
      if (
        (v?.quantity !== undefined && (isNaN(rawQ) || rawQ < 0)) ||
        (rawF1 !== undefined && (isNaN(rawF1) || rawF1 < 0)) ||
        (rawF2 !== undefined && (isNaN(rawF2) || rawF2 < 0))
      ) {
        throw new ApiError(400, 'INVALID_QUANTITY', 'Số lượng tồn kho biến thể phải là số nguyên không âm', {
          quantity: 'Không hợp lệ',
        });
      }
      const f1 = rawF1 !== undefined ? rawF1 : vFloor === 'FLOOR_1' ? rawQ : 0;
      const f2 = rawF2 !== undefined ? rawF2 : vFloor === 'FLOOR_2' ? rawQ : 0;
      return { f1, f2, stock: f1 + f2 };
    };

    const current = getFloorStocks(product);
    const newScheme = isNewSchemeProduct(product);
    let additions: any[];
    if (newScheme) {
      additions = prepareSchemeVariants(product.code, raw, current.variants).map((v) => {
        const st = parseVariantStock(v);
        return {
          variantKey: v.variantKey,
          color: v.color,
          colorCode: v.colorCode || undefined,
          colorHexes: sanitizeColorHexes(v.colorHexes),
          size: v.size,
          variantCode: v.variantCode,
          barcode: v.variantCode,
          sellingPrice: parseMoneyField(v.sellingPrice, 'sellingPrice', 'INVALID_PRICE', 'Giá bán biến thể'),
          costPrice: parseMoneyField(v.costPrice, 'costPrice', 'INVALID_COST_PRICE', 'Giá gốc biến thể'),
          stockFloor1: st.f1,
          stockFloor2: st.f2,
          stock: st.stock,
        };
      });
    } else {
      const keys = new Set(current.variants.map((v) => v.variantKey));
      additions = raw.map((v) => {
        const color = String(v.color || '').trim();
        const size = String(v.size || '').trim().toUpperCase();
        const key = buildVariantKey(color, size);
        if (keys.has(key)) {
          throw new ApiError(400, 'DUPLICATE_VARIANT', `Biến thể ${color || '-'} / ${size || '-'} đã tồn tại`, {
            variants: 'Trùng màu + size',
          });
        }
        keys.add(key);
        const vc = generateVariantProductCode(product.code, color, size);
        const st = parseVariantStock(v);
        return {
          variantKey: key,
          color,
          colorHexes: sanitizeColorHexes(v.colorHexes),
          size,
          variantCode: vc,
          barcode: vc,
          sellingPrice: parseMoneyField(v.sellingPrice, 'sellingPrice', 'INVALID_PRICE', 'Giá bán biến thể'),
          costPrice: parseMoneyField(v.costPrice, 'costPrice', 'INVALID_COST_PRICE', 'Giá gốc biến thể'),
          stockFloor1: st.f1,
          stockFloor2: st.f2,
          stock: st.stock,
        };
      });
    }
    const totalAddedStock = additions.reduce((s, a) => s + (Number(a.stock) || 0), 0);
    if (totalAddedStock > 0 && ctx.user?.role !== 'CEO' && ctx.user?.role !== 'ADMIN') {
      throw new ApiError(
        403,
        'DIRECT_STOCK_FORBIDDEN',
        'Chỉ CEO/Admin mới được thêm biến thể kèm số lượng tồn kho ban đầu'
      );
    }
    additions = additions.map((a) => {
      const out = { ...a };
      if (out.sellingPrice === undefined) delete out.sellingPrice;
      if (out.costPrice === undefined) delete out.costPrice;
      return out;
    });
    const conflicts = await findCodeConflicts(additions.map((a) => a.variantCode), String(product._id));
    if (conflicts.length > 0) {
      throw new ApiError(409, 'CODE_CONFLICT', `Mã ${conflicts[0].code} đã được dùng bởi sản phẩm ${conflicts[0].productCode}`, {
        code: conflicts[0].code,
        conflictProductId: conflicts[0].productId,
      });
    }
    // Sản phẩm đang có tồn chung (chưa chia biến thể) -> giữ tồn cũ vào biến thể DEFAULT
    const base =
      current.variants.length === 0 && current.stock > 0
        ? [{ variantKey: 'DEFAULT', color: '', size: '', stockFloor1: current.stockFloor1, stockFloor2: current.stockFloor2, stock: current.stock }]
        : current.variants;
    const sum = summarizeVariants([...base, ...additions], product.code, { newScheme });
    const updated = await productRepo.updateById(String(product._id), {
      variants: sum.variants,
      stockFloor1: sum.stockFloor1,
      stockFloor2: sum.stockFloor2,
      stock: sum.stock,
    } as any);

    if (totalAddedStock > 0) {
      let runningBalance = current.stock;
      const actorId = ctx.user?.userId || 'ADMIN';
      const actorName = ctx.user?.fullName || 'Quản lý kho (CMS)';
      const actorRole = inferActorRole(ctx.user?.role, actorId, actorName);
      for (const a of additions) {
        const floorEntries: { floor: 'FLOOR_1' | 'FLOOR_2'; qty: number }[] = [];
        if (a.stockFloor1 > 0) floorEntries.push({ floor: 'FLOOR_1', qty: a.stockFloor1 });
        if (a.stockFloor2 > 0) floorEntries.push({ floor: 'FLOOR_2', qty: a.stockFloor2 });
        for (const fe of floorEntries) {
          const nextBal = runningBalance + fe.qty;
          await stockMovementRepo.create({
            type: 'ADJUSTMENT',
            productId: product._id,
            productCode: product.code,
            productName: formatProductWithVariant(product.name, a.color, a.size),
            color: a.color,
            size: a.size,
            categoryId: product.categoryId,
            unit: product.unit,
            quantityChange: fe.qty,
            balanceBefore: runningBalance,
            balanceAfter: nextBal,
            warehouseLocation: fe.floor,
            referenceType: 'ADJUSTMENT',
            referenceId: product._id,
            referenceCode: 'CMS-DIEU-CHINH',
            performedBy: actorId,
            performedByName: actorName,
            performedByRole: actorRole,
            note: `[${floorLabel(fe.floor)}] ${actorRole === 'CEO' ? 'CEO' : 'Admin'} thêm biến thể ${a.variantCode} kèm tồn kho trực tiếp (${fe.qty} ${product.unit})`,
          } as any);
          runningBalance = nextBal;
        }
      }
    }

    return ok(updated, { addedVariants: additions.length, addedQuantity: totalAddedStock });
}

export async function updateProductVariant(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
  if (!isPriceManager(ctx.user?.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản lý/Admin/Kế toán kho mới được cập nhật biến thể');
    }
    const product = await productRepo.findById(id);
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm');
    const rawPatches: any[] = Array.isArray(body.variants)
      ? body.variants
      : body.variantCode || body.variantKey || body.fromVariantCode || body.fromVariantKey || body.color !== undefined || body.size !== undefined || body.colorCode !== undefined
      ? [body]
      : [];
    if (rawPatches.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Danh sách biến thể cập nhật trống', { variants: 'Bắt buộc' });
    }

    const current = getFloorStocks(product);
    const sum = await buildPatchedVariantsForProduct(product, current.variants, rawPatches, {
      partial: true,
      role: ctx.user?.role,
    });

    const updated = await productRepo.updateById(String(product._id), {
      variants: sum.variants,
      stockFloor1: sum.stockFloor1,
      stockFloor2: sum.stockFloor2,
      stock: sum.stock,
    } as any);
    const updatedFloors = getFloorStocks(updated);
    return ok({
        ...updated,
        variants: updatedFloors.variants,
        stockFloor1: updatedFloors.stockFloor1,
        stockFloor2: updatedFloors.stockFloor2,
        stock: updatedFloors.stock,
      }, { updatedVariants: rawPatches.length });
}

