import { Router } from 'express';
import { categoryRepo, productRepo, stockMovementRepo, staffRepo } from '../config/db';
import { ensureStandardProductCodesMigrated } from '../config/seed';
import {
  generateProductCode,
  generateVariantProductCode,
  extractVariantFromText,
  buildVariantKey,
  isStandardSixDigitProductCode,
  isNewSchemeProduct,
  isCompactBarcodeMatchVariant,
  normalizeToCompactUpperCode,
  resolveVariantPricing,
} from '../utils/productCode';
import {
  resolveCategoryAndBrand,
  resolveVersionCode,
  buildSchemeRootCode,
  prepareSchemeVariants,
  findCodeConflicts,
  findDuplicateProduct,
  syncProductReferencesAfterRecode,
} from '../utils/productScheme';
import { ApiError } from '../utils/errors';
import {
  normalizeFloor,
  floorLabel,
  getFloorStocks,
  getVariantFloorStocks,
  applyFloorDelta,
  summarizeVariants,
  formatProductWithVariant,
  sanitizeColorHexes,
} from '../utils/warehouseFloor';
import { enrichProductsWithSetLinks, executeUnpackSetToRetail } from '../utils/unpackSet';
import { filterAndRankBySearch } from '../utils/search';

export const productsInventoryRouter = Router();

// Quản lý/Admin/CEO (role ADMIN | CEO) và Kế toán & Kho (role ACCOUNTANT) quản lý giá & tồn
const isPriceManager = (role?: string) => role === 'CEO' || role === 'ADMIN' || role === 'ACCOUNTANT';
const canEditSellingPrice = (role?: string) => role === 'CEO' || role === 'ADMIN' || role === 'ACCOUNTANT';

function inferActorRole(
  explicitRole?: string,
  userId?: string,
  userName?: string,
  staffRoleMap?: Map<string, string>,
  fallback = 'ADMIN'
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
  if (upperId === 'SALES') return 'SALES';
  const nameLower = String(userName || '').toLowerCase();
  if (nameLower.includes('admin') || nameLower.includes('quản trị') || nameLower.includes('quản lý')) {
    return 'ADMIN';
  }
  if (nameLower.includes('kế toán') || nameLower.includes('thủ kho') || nameLower.includes('kho')) {
    return 'ACCOUNTANT';
  }
  return fallback;
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

// POST /api/v1/products/generate-code
productsInventoryRouter.post('/products/generate-code', async (req, res, next) => {
  try {
    const { name, categoryCode, categoryName, brand, modelName, color, size } = req.body || {};
    if (!name && !brand && !modelName) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tên sản phẩm là bắt buộc để sinh mã', {
        name: 'Bắt buộc',
      });
    }

    const extracted = extractVariantFromText(String(name || ''), {
      categoryCode,
      categoryName,
      brand,
      modelName,
    });
    const code =
      extracted.code ||
      generateProductCode(String(name || ''), {
        categoryCode,
        categoryName,
        brand,
        modelName,
      });

    const finalColor = color !== undefined ? String(color).trim() : extracted.color;
    const finalSize = size !== undefined ? String(size).trim().toUpperCase() : extracted.size;
    const variantCode = generateVariantProductCode(code, finalColor, finalSize);

    res.json({
      data: {
        code,
        variantCode,
        baseName: extracted.baseName,
        color: finalColor,
        size: finalSize,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

/** Ẩn giá vốn (gốc + biến thể) với role SALES, bổ sung giá hiệu lực của biến thể */
function presentVariants(product: any, variants: any[], hideCost: boolean) {
  const baseSelling = Math.max(0, Math.round(Number(product?.sellingPrice) || 0));
  return variants.map((v: any) => {
    const { costPrice, ...rest } = v || {};
    const vSelling = Math.round(Number(v?.sellingPrice) || 0);
    return {
      ...rest,
      ...(hideCost ? {} : costPrice !== undefined ? { costPrice } : {}),
      effectiveSellingPrice: vSelling > 0 ? vSelling : baseSelling,
    };
  });
}

// POST /api/v1/products/preview-code (v5.0) — xem trước mã theo Category + Brand + Version (không ghi DB)
productsInventoryRouter.post('/products/preview-code', async (req, res, next) => {
  try {
    const { categoryId, brandId, versionName, versionCode, variants, excludeProductId } = req.body || {};
    const { category, brand, categoryCode } = await resolveCategoryAndBrand(categoryId, brandId);
    const version = resolveVersionCode(versionName, versionCode);
    const code = buildSchemeRootCode(categoryCode, brand.code, version.versionCode);
    const preparedVariants = prepareSchemeVariants(code, Array.isArray(variants) ? variants : []);
    const duplicate = await findDuplicateProduct(
      String(category._id),
      String(brand._id),
      version.versionCode,
      excludeProductId ? String(excludeProductId) : undefined
    );
    const conflicts = await findCodeConflicts(
      [code, ...preparedVariants.map((v) => v.variantCode)],
      duplicate ? String(duplicate._id) : excludeProductId ? String(excludeProductId) : undefined
    );
    res.json({
      data: {
        categoryCode,
        brandCode: brand.code,
        brandName: brand.name,
        versionName: version.versionName,
        versionCode: version.versionCode,
        suggestedVersionCode: version.suggested,
        code,
        variants: preparedVariants.map((v) => ({
          color: v.color,
          colorCode: v.colorCode,
          size: v.size,
          sizeCode: v.sizeCode,
          variantCode: v.variantCode,
        })),
        duplicate: duplicate
          ? { _id: duplicate._id, code: duplicate.code, name: duplicate.name, versionName: (duplicate as any).versionName || '' }
          : null,
        conflicts,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/lookup?code= (v5.0) — tra cứu theo mã quét (mã mới, mã con, mã cũ)
productsInventoryRouter.get('/products/lookup', async (req, res, next) => {
  try {
    const raw = String(req.query.code || '').trim();
    const code = normalizeToCompactUpperCode(raw);
    if (!code) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Thiếu mã cần tra cứu', { code: 'Bắt buộc' });
    }
    const all = await productRepo.find({});
    const norm = (v: any) => normalizeToCompactUpperCode(String(v || ''));
    type Hit = { product: any; variant: any | null; matchedBy: string };
    let hit: Hit | null = null;
    const passes: ((p: any, floors: any) => Hit | null)[] = [
      (p) => (norm(p.code) === code || norm(p.barcode) === code ? { product: p, variant: null, matchedBy: 'CODE' } : null),
      (p, f) => {
        const v = f.variants.find((x: any) => norm(x.variantCode) === code || norm(x.barcode) === code);
        return v ? { product: p, variant: v, matchedBy: 'VARIANT_CODE' } : null;
      },
      (p) =>
        norm(p.legacyCode) === code || (p.legacyCodes || []).some((c: any) => norm(c) === code)
          ? { product: p, variant: null, matchedBy: 'LEGACY_CODE' }
          : null,
      (p, f) => {
        const v = f.variants.find(
          (x: any) =>
            norm(x.legacyVariantCode) === code || (x.legacyVariantCodes || []).some((c: any) => norm(c) === code)
        );
        return v ? { product: p, variant: v, matchedBy: 'LEGACY_VARIANT_CODE' } : null;
      },
      (p, f) => {
        const v = f.variants.find(
          (x: any) =>
            isCompactBarcodeMatchVariant(code, x.variantCode) ||
            (x.legacyVariantCode && isCompactBarcodeMatchVariant(code, x.legacyVariantCode))
        );
        return v ? { product: p, variant: v, matchedBy: 'COMPACT_BARCODE' } : null;
      },
    ];
    const withFloors = all.map((p) => ({ p, f: getFloorStocks(p) }));
    for (const pass of passes) {
      for (const { p, f } of withFloors) {
        hit = pass(p, f);
        if (hit) break;
      }
      if (hit) break;
    }
    if (!hit) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', `Không tìm thấy sản phẩm với mã "${raw}"`);
    }
    const hideCost = req.user?.role === 'SALES';
    const floors = getFloorStocks(hit.product);
    const { costPrice, ...rest } = hit.product;
    const pricing = resolveVariantPricing(hit.product, hit.variant?.color, hit.variant?.size);
    const [variantOut] = hit.variant ? presentVariants(hit.product, [hit.variant], hideCost) : [null];
    res.json({
      data: {
        product: {
          ...rest,
          ...(hideCost ? {} : { costPrice: Number(costPrice) || 0 }),
          variants: presentVariants(hit.product, floors.variants, hideCost),
          stockFloor1: floors.stockFloor1,
          stockFloor2: floors.stockFloor2,
          stock: floors.stock,
        },
        variant: variantOut,
        matchedBy: hit.matchedBy,
        sellingPrice: pricing.sellingPrice,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products
productsInventoryRouter.get('/products', async (req, res, next) => {
  try {
    await ensureStandardProductCodesMigrated();
    const { categoryId, search, onlySellable } = req.query;
    const allProducts = await productRepo.find({}, { createdAt: -1 });
    const categories = await categoryRepo.find({});
    const catMap = new Map(categories.map((c) => [String(c._id), c]));
    const catByCode = new Map(categories.map((c) => [String(c.code || '').toUpperCase(), c]));
    const catByName = new Map(categories.map((c) => [String(c.name || '').trim().toLowerCase(), c]));

    // Ẩn giá gốc và chỉ hiển thị sản phẩm Kho Tầng 1 đối với nhân viên bán hàng (SALES)
    const isSalesRole = req.user?.role === 'SALES';
    const hideCost = isSalesRole;
    const setLinksMap = enrichProductsWithSetLinks(allProducts);
    const baseFiltered = allProducts
      .map((p) => {
        const cat =
          catMap.get(String(p.categoryId)) ||
          (p.categoryCode ? catByCode.get(String(p.categoryCode).toUpperCase()) : undefined) ||
          (p.categoryName ? catByName.get(String(p.categoryName).trim().toLowerCase()) : undefined);
        const { costPrice, ...rest } = p as any;
        const floors = getFloorStocks(p);
        const setLinkInfo = setLinksMap.get(String(p._id)) || {};
        const visibleVariants = floors.variants.map((v) => {
          const hasAttr = Boolean(
            (v.color && String(v.color).trim()) || (v.size && String(v.size).trim())
          );
          const vCode = hasAttr
            ? isNewSchemeProduct(p)
              ? v.variantCode || p.code
              : generateVariantProductCode(p.code, v.color, v.size)
            : v.variantCode || p.code;
          return {
            ...v,
            variantCode: vCode,
            barcode: vCode,
            stockFloor1: v.stockFloor1,
            stockFloor2: isSalesRole ? 0 : v.stockFloor2,
            stock: isSalesRole ? v.stockFloor1 : v.stock,
          };
        });
        return {
          ...rest,
          barcode: p.barcode || p.code,
          brand: p.brandName || p.brand || '',
          modelName: p.modelName || '',
          note: (p as any).note || '',
          variants: presentVariants(p, visibleVariants, hideCost),
          categoryId: cat?._id ? String(cat._id) : p.categoryId,
          stockFloor1: floors.stockFloor1,
          stockFloor2: isSalesRole ? 0 : floors.stockFloor2,
          stock: isSalesRole ? floors.stockFloor1 : floors.stock,
          ...setLinkInfo,
          ...(hideCost ? {} : { costPrice: Number(costPrice) || 0 }),
          categoryCode: cat?.code || p.categoryCode || '',
          categoryName: cat?.name || p.categoryName || '',
        };
      })
      .filter((p) => {
        const effectiveFloor1 =
          (Number(p.stockFloor1) || 0) + (Number(p.maxUnpackableFloor1) || 0);
        if (isSalesRole && effectiveFloor1 <= 0) return false;
        if (categoryId && String(p.categoryId) !== String(categoryId)) return false;
        if (onlySellable === 'true') {
          if (!(p.sellingPrice > 0 && effectiveFloor1 > 0)) return false;
        }
        return true;
      });

    const filtered = search
      ? filterAndRankBySearch(baseFiltered, String(search), (p) => [
          { text: p.code, weight: 1.5 },
          { text: (p as any).barcode, weight: 1.5 },
          { text: p.name, weight: 1.3 },
          { text: p.brand, weight: 1.1 },
          { text: (p as any).versionName, weight: 1.2 },
          { text: (p as any).legacyCode, weight: 1.4 },
          ...(((p as any).legacyCodes || []) as string[]).map((c) => ({ text: c, weight: 1.4 })),
          { text: p.categoryName, weight: 0.9 },
          { text: p.categoryCode, weight: 0.9 },
          { text: p.unit, weight: 0.6 },
          { text: (p as any).note, weight: 0.8 },
          ...(Array.isArray(p.variants)
            ? p.variants.flatMap((v: any) => [
                { text: v.variantCode, weight: 1.6 },
                { text: v.barcode, weight: 1.5 },
                { text: v.legacyVariantCode, weight: 1.4 },
                ...(((v as any).legacyVariantCodes || []) as string[]).map((c) => ({ text: c, weight: 1.4 })),
                { text: v.color, weight: 0.8 },
                { text: v.size, weight: 0.8 },
              ])
            : []),
        ])
      : baseFiltered;

    const totalProducts = filtered.length;
    const totalStock = filtered.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);

    res.json({
      data: filtered,
      meta: {
        totalProducts,
        totalStock,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/products
productsInventoryRouter.post('/products', async (req, res, next) => {
  try {
    const {
      code: explicitCode,
      name,
      brand,
      modelName,
      color,
      colorHexes: rawColorHexes,
      size,
      variants: rawInputVariants,
      categoryId,
      unit,
      sellingPrice,
      costPrice,
      quantity,
      targetWarehouse,
      upsertIfExists,
      parentSetProductId,
      packSize,
      brandId,
      note,
    } = req.body || {};
    const targetFloor = normalizeFloor(targetWarehouse);

    // v5.0 — Luồng mới: chọn Category -> Brand -> nhập Version, sinh mã theo R1, KHÔNG tự khớp mã cũ (R9)
    if (brandId) {
      const result = await createNewSchemeProduct(req);
      if (result && (result as any).__upserted) {
        return res.status(200).json({ data: (result as any).data, meta: (result as any).meta });
      }
      return res.status(201).json({ data: result, meta: {} });
    }

    if (!name || !String(name).trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tên sản phẩm là bắt buộc', {
        name: 'Bắt buộc',
      });
    }

    let category = categoryId ? await categoryRepo.findById(String(categoryId)) : null;
    if (!category) {
      if (categoryId) {
        category = await categoryRepo.findOne({ code: String(categoryId).toUpperCase() });
      }
      if (!category) {
        const allCats = await categoryRepo.find({ status: 'ACTIVE' });
        category = allCats[0] || null;
      }
    }

    if (!category) {
      throw new ApiError(400, 'CATEGORY_REQUIRED', 'Vui lòng chọn danh mục (category) hợp lệ', {
        categoryId: 'Danh mục không hợp lệ',
      });
    }

    const normalizedUnit = unit ? String(unit).trim() : 'Cái';
    const extracted = extractVariantFromText(String(name), {
      categoryCode: category.code,
      categoryName: category.name,
      brand,
      modelName,
    });
    const finalColor = color !== undefined ? String(color).trim() : extracted.color;
    const finalSize = size !== undefined ? String(size).trim().toUpperCase() : extracted.size;
    const cleanProductName =
      color !== undefined || size !== undefined || (Array.isArray(rawInputVariants) && rawInputVariants.length > 0)
        ? extracted.baseName || String(name).trim()
        : extracted.baseName || String(name).trim();

    const cleanExplicitCode = explicitCode
      ? generateProductCode(String(explicitCode), { keepVariantInCode: true })
      : '';
    const existingByExplicitCode = cleanExplicitCode
      ? await productRepo.findOne({ code: cleanExplicitCode })
      : null;
    let code =
      (existingByExplicitCode ? existingByExplicitCode.code : '') ||
      (cleanExplicitCode && isStandardSixDigitProductCode(cleanExplicitCode)
        ? cleanExplicitCode
        : '') ||
      extracted.code ||
      generateProductCode(String(name), {
        categoryCode: category.code,
        categoryName: category.name,
        brand,
        modelName,
        existingCode: cleanExplicitCode,
      });

    if (!code) {
      throw new ApiError(400, 'INVALID_PRODUCT_NAME', 'Không thể sinh mã sản phẩm từ tên này');
    }

    const price = sellingPrice !== undefined ? Math.round(Number(sellingPrice)) : 0;
    if (isNaN(price) || price < 0) {
      throw new ApiError(400, 'INVALID_PRICE', 'Giá bán phải là số nguyên không âm');
    }
    if (price > 0 && !isPriceManager(req.user?.role)) {
      throw new ApiError(403, 'SELLING_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được đặt giá bán');
    }

    const cost = costPrice !== undefined ? Math.round(Number(costPrice)) : 0;
    if (isNaN(cost) || cost < 0) {
      throw new ApiError(400, 'INVALID_COST_PRICE', 'Giá gốc phải là số nguyên không âm');
    }
    if (cost > 0 && !isPriceManager(req.user?.role)) {
      throw new ApiError(403, 'COST_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được đặt giá gốc');
    }

    // Nếu truyền mảng variants[] (nhập nhiều Size/Màu cùng lúc vào 1 Mã gốc, mỗi biến thể có Mã con riêng)
    const inputVariantsList =
      Array.isArray(rawInputVariants) && rawInputVariants.length > 0
        ? rawInputVariants.map((rv: any) => {
            const vColor = String(rv.color || '').trim();
            const vSize = String(rv.size || '').trim().toUpperCase();
            const vColorCode = rv.colorCode ? String(rv.colorCode).trim().toUpperCase() : undefined;
            const vQty = Math.max(0, Math.round(Number(rv.quantity ?? rv.stock ?? 0)));
            const vF1 =
              rv.stockFloor1 !== undefined
                ? Math.max(0, Math.round(Number(rv.stockFloor1) || 0))
                : targetFloor === 'FLOOR_1'
                ? vQty
                : 0;
            const vF2 =
              rv.stockFloor2 !== undefined
                ? Math.max(0, Math.round(Number(rv.stockFloor2) || 0))
                : targetFloor === 'FLOOR_2'
                ? vQty
                : 0;
            const childCode = generateVariantProductCode(code, vColor, vSize);
            return {
              color: vColor,
              ...(vColorCode ? { colorCode: vColorCode } : {}),
              colorHexes: sanitizeColorHexes(rv.colorHexes),
              size: vSize,
              variantCode: childCode,
              barcode: childCode,
              stockFloor1: vF1,
              stockFloor2: vF2,
              stock: vF1 + vF2,
            };
          })
        : null;

    const qty =
      inputVariantsList !== null
        ? inputVariantsList.reduce((s, v) => s + v.stock, 0)
        : quantity !== undefined
        ? Math.round(Number(quantity))
        : 0;

    if (isNaN(qty) || qty < 0) {
      throw new ApiError(400, 'INVALID_QUANTITY', 'Số lượng nhập kho phải là số nguyên không âm');
    }
    if (qty > 0 && !isPriceManager(req.user?.role)) {
      throw new ApiError(
        403,
        'DIRECT_STOCK_FORBIDDEN',
        'Chỉ Quản lý/Admin mới được nhập thẳng số lượng sản phẩm vào kho'
      );
    }

    let existing = existingByExplicitCode || (await productRepo.findOne({ code }));
    if (
      existing &&
      !isNewSchemeProduct(existing) &&
      String(existing.unit || 'Cái').trim().toLowerCase() !== normalizedUnit.toLowerCase()
    ) {
      code = generateProductCode(cleanProductName, {
        categoryCode: category.code,
        categoryName: category.name,
        brand: brand || extracted.brand,
        modelName,
        seedSuffix: normalizedUnit,
      });
      existing = await productRepo.findOne({ code });
    }


    if (existing) {
      // R9: chỉ cộng dồn vào sản phẩm đã có khi client chủ động gửi upsertIfExists = true
      if (upsertIfExists === true && isPriceManager(req.user?.role)) {
        let workingProd: any = { ...existing };
        const beforeStock = getFloorStocks(existing).stock;
        const targetNewScheme = isNewSchemeProduct(existing);

        if (inputVariantsList) {
          const mergedVariants = [...getFloorStocks(existing).variants, ...inputVariantsList];
          const sum = summarizeVariants(mergedVariants, existing.code, { newScheme: targetNewScheme });
          workingProd = {
            ...workingProd,
            variants: sum.variants,
            stockFloor1: sum.stockFloor1,
            stockFloor2: sum.stockFloor2,
            stock: sum.stock,
          };
        } else {
          const floorResult = applyFloorDelta(
            existing,
            targetFloor,
            qty,
            finalColor,
            finalSize,
            sanitizeColorHexes(rawColorHexes),
            req.body?.colorCode
          );
          workingProd = {
            ...workingProd,
            variants: floorResult.variants,
            stockFloor1: floorResult.stockFloor1,
            stockFloor2: floorResult.stockFloor2,
            stock: floorResult.stock,
          };
        }

        const patchFields: Record<string, any> = {
          variants: workingProd.variants,
          stockFloor1: workingProd.stockFloor1,
          stockFloor2: workingProd.stockFloor2,
          stock: workingProd.stock,
          barcode: existing.barcode || existing.code,
        };
        if (cost > 0) patchFields.costPrice = cost;
        if (price > 0) patchFields.sellingPrice = price;
        if (brand) patchFields.brand = String(brand).trim();
        if (modelName) patchFields.modelName = String(modelName).trim();
        if (note !== undefined && String(note).trim()) patchFields.note = String(note).trim();

        const updated = await productRepo.updateById(existing._id, patchFields);
        const addedQty = workingProd.stock - beforeStock;
        if (addedQty > 0) {
          const actorId = req.user?.userId || 'ADMIN';
          const actorName = req.user?.fullName || 'Quản lý kho (CMS)';
          const actorRole = inferActorRole(req.user?.role, actorId, actorName);
          await stockMovementRepo.create({
            type: 'IMPORT',
            productId: existing._id,
            productCode: existing.code,
            productName: formatProductWithVariant(existing.name, finalColor, finalSize),
            color: finalColor,
            size: finalSize,
            categoryId: existing.categoryId,
            unit: existing.unit,
            quantityChange: addedQty,
            balanceBefore: beforeStock,
            balanceAfter: workingProd.stock,
            warehouseLocation: targetFloor,
            referenceType: 'IMPORT_RECEIPT',
            referenceId: existing._id,
            referenceCode: 'CMS-NHAP-THANG',
            performedBy: actorId,
            performedByName: actorName,
            performedByRole: actorRole,
            note: `${actorRole === 'ADMIN' ? 'Admin' : 'Thủ kho'} nhập thêm ${addedQty} ${existing.unit} vào mã ${existing.code} (${floorLabel(targetFloor)}) trên CMS`,
          });
        }

        return res.status(200).json({
          data: updated,
          meta: { upserted: true, addedQuantity: addedQty, targetWarehouse: targetFloor },
        });
      }

      throw new ApiError(
        409,
        'PRODUCT_DUPLICATE',
        `Sản phẩm "${existing.name}" (mã ${code}) đã tồn tại. Chọn "thêm biến thể vào sản phẩm này" hoặc đổi thông tin sản phẩm.`,
        { code: 'Đã tồn tại', existingProductId: String(existing._id), existingProductCode: existing.code }
      );
    }

    const singleVariantCode = generateVariantProductCode(code, finalColor, finalSize);
    const initialVariants = inputVariantsList
      ? summarizeVariants(inputVariantsList, code).variants
      : finalColor || finalSize
      ? [
          {
            variantKey: buildVariantKey(finalColor, finalSize),
            color: finalColor,
            colorHexes: sanitizeColorHexes(rawColorHexes),
            size: finalSize,
            variantCode: singleVariantCode,
            barcode: singleVariantCode,
            stockFloor1: targetFloor === 'FLOOR_1' ? qty : 0,
            stockFloor2: targetFloor === 'FLOOR_2' ? qty : 0,
            stock: qty,
          },
        ]
      : [];

    const initialSummary =
      initialVariants.length > 0
        ? summarizeVariants(initialVariants, code)
        : {
            variants: [],
            stockFloor1: targetFloor === 'FLOOR_1' ? qty : 0,
            stockFloor2: targetFloor === 'FLOOR_2' ? qty : 0,
            stock: qty,
          };

    const cleanParentSetId = parentSetProductId ? String(parentSetProductId).trim() : '';
    const cleanPackSize = cleanParentSetId
      ? Math.max(0, Math.round(Number(packSize) || 0))
      : 0;

    const created = await productRepo.create({
      code,
      barcode: code, // Mã gốc sản phẩm; từng biến thể con lưu mã tem riêng tại variants[].variantCode
      name: cleanProductName,
      brand: brand ? String(brand).trim() : extracted.brand || '',
      modelName: modelName ? String(modelName).trim() : extracted.modelName || '',
      categoryId: category._id,
      categoryCode: category.code,
      categoryName: category.name,
      unit: normalizedUnit,
      sellingPrice: price,
      costPrice: cost,
      variants: initialSummary.variants,
      stockFloor1: initialSummary.stockFloor1,
      stockFloor2: initialSummary.stockFloor2,
      stock: initialSummary.stock,
      parentSetProductId: cleanParentSetId,
      packSize: cleanPackSize,
      note: note !== undefined ? String(note).trim() : '',
      status: 'ACTIVE',
    });

    if (initialSummary.stock > 0) {
      const actorId = req.user?.userId || 'ADMIN';
      const actorName = req.user?.fullName || 'Quản lý kho (CMS)';
      const actorRole = inferActorRole(req.user?.role, actorId, actorName);
      await stockMovementRepo.create({
        type: 'IMPORT',
        productId: created._id,
        productCode: created.code,
        productName: formatProductWithVariant(created.name, finalColor, finalSize),
        color: finalColor,
        size: finalSize,
        categoryId: created.categoryId,
        unit: created.unit,
        quantityChange: initialSummary.stock,
        balanceBefore: 0,
        balanceAfter: initialSummary.stock,
        warehouseLocation: targetFloor,
        referenceType: 'IMPORT_RECEIPT',
        referenceId: created._id,
        referenceCode: 'CMS-NHAP-THANG',
        performedBy: actorId,
        performedByName: actorName,
        performedByRole: actorRole,
        note: `${actorRole === 'ADMIN' ? 'Admin' : 'Thủ kho'} nhập thẳng sản phẩm mới vào ${floorLabel(targetFloor)} trên CMS (${initialSummary.stock} ${created.unit})`,
      });
    }

    res.status(201).json({
      data: created,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

function parseMoneyField(raw: any, field: string, code: string, label: string): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const v = Math.round(Number(raw));
  if (isNaN(v) || v < 0) {
    throw new ApiError(400, code, `${label} phải là số nguyên không âm`, { [field]: 'Không hợp lệ' });
  }
  return v;
}

/** Kiểm tra quyền đặt giá (gốc + biến thể) giống luồng cũ */
function assertPricePermission(role: string | undefined, selling: number[], cost: number[]) {
  if (selling.some((p) => p > 0) && !isPriceManager(role)) {
    throw new ApiError(403, 'SELLING_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được đặt giá bán');
  }
  if (cost.some((c) => c > 0) && !isPriceManager(role)) {
    throw new ApiError(403, 'COST_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được đặt giá gốc');
  }
}

/** v5.0: tạo sản phẩm theo quy chuẩn mã mới (R1–R4, R8–R10) */
async function createNewSchemeProduct(req: any) {
  const body = req.body || {};
  const targetFloor = normalizeFloor(body.targetWarehouse);
  const { category, brand, categoryCode } = await resolveCategoryAndBrand(body.categoryId, body.brandId);
  if (brand.status === 'INACTIVE') {
    throw new ApiError(400, 'BRAND_INACTIVE', `Thương hiệu "${brand.name}" đã ngừng sử dụng`, { brandId: 'Ngừng sử dụng' });
  }
  const version = resolveVersionCode(body.versionName, body.versionCode);
  const code = buildSchemeRootCode(categoryCode, brand.code, version.versionCode);

  const duplicate = await findDuplicateProduct(String(category._id), String(brand._id), version.versionCode);
  if (duplicate) {
    if (body.upsertIfExists === true && isPriceManager(req.user?.role)) {
      const beforeStock = getFloorStocks(duplicate).stock;
      const upsertedColor = body.color !== undefined ? String(body.color).trim() : '';
      const upsertedSize = body.size !== undefined ? String(body.size).trim().toUpperCase() : '';
      const upsertedQty = Math.max(0, Math.round(Number(body.quantity) || 0));
      let nextFloors: { stockFloor1: number; stockFloor2: number; stock: number; variants: any[] };
      if (Array.isArray(body.variants) && body.variants.length > 0) {
        const mapped = body.variants.map((rv: any) => {
          const vFloor = normalizeFloor(rv?.targetWarehouse ?? body.targetWarehouse);
          const vQty = Math.max(0, Math.round(Number(rv?.quantity ?? rv?.stock ?? 0)));
          const vF1 = rv?.stockFloor1 !== undefined ? Math.max(0, Math.round(Number(rv.stockFloor1) || 0)) : vFloor === 'FLOOR_1' ? vQty : 0;
          const vF2 = rv?.stockFloor2 !== undefined ? Math.max(0, Math.round(Number(rv.stockFloor2) || 0)) : vFloor === 'FLOOR_2' ? vQty : 0;
          return {
            color: String(rv?.color || '').trim(),
            colorCode: rv?.colorCode ? String(rv.colorCode).trim().toUpperCase() : undefined,
            colorHexes: sanitizeColorHexes(rv?.colorHexes),
            size: String(rv?.size || '').trim().toUpperCase(),
            sellingPrice: parseMoneyField(rv?.sellingPrice, 'variants.sellingPrice', 'INVALID_PRICE', 'Giá bán biến thể'),
            costPrice: parseMoneyField(rv?.costPrice, 'variants.costPrice', 'INVALID_COST_PRICE', 'Giá gốc biến thể'),
            stockFloor1: vF1,
            stockFloor2: vF2,
            stock: vF1 + vF2,
          };
        });
        nextFloors = summarizeVariants([...getFloorStocks(duplicate).variants, ...mapped], duplicate.code, {
          newScheme: true,
        });
      } else {
        nextFloors = applyFloorDelta(
          duplicate,
          targetFloor,
          upsertedQty,
          upsertedColor,
          upsertedSize,
          sanitizeColorHexes(body.colorHexes),
          body.colorCode
        );
      }
      const patchFields: Record<string, any> = {
        variants: nextFloors.variants,
        stockFloor1: nextFloors.stockFloor1,
        stockFloor2: nextFloors.stockFloor2,
        stock: nextFloors.stock,
      };
      const upPrice = parseMoneyField(body.sellingPrice, 'sellingPrice', 'INVALID_PRICE', 'Giá bán') ?? 0;
      const upCost = parseMoneyField(body.costPrice, 'costPrice', 'INVALID_COST_PRICE', 'Giá gốc') ?? 0;
      if (upCost > 0) patchFields.costPrice = upCost;
      if (upPrice > 0) patchFields.sellingPrice = upPrice;
      if (body.note !== undefined && String(body.note).trim()) patchFields.note = String(body.note).trim();
      const updated = await productRepo.updateById(String(duplicate._id), patchFields);
      const addedQty = nextFloors.stock - beforeStock;
      if (addedQty > 0) {
        const actorId = req.user?.userId || 'ADMIN';
        const actorName = req.user?.fullName || 'Quản lý kho (CMS)';
        const actorRole = inferActorRole(req.user?.role, actorId, actorName);
        await stockMovementRepo.create({
          type: 'IMPORT',
          productId: duplicate._id,
          productCode: duplicate.code,
          productName: formatProductWithVariant(duplicate.name, upsertedColor, upsertedSize),
          color: upsertedColor,
          size: upsertedSize,
          categoryId: duplicate.categoryId,
          unit: duplicate.unit,
          quantityChange: addedQty,
          balanceBefore: beforeStock,
          balanceAfter: nextFloors.stock,
          warehouseLocation: targetFloor,
          referenceType: 'IMPORT_RECEIPT',
          referenceId: duplicate._id,
          referenceCode: 'CMS-NHAP-THANG',
          performedBy: actorId,
          performedByName: actorName,
          performedByRole: actorRole,
          note: `${actorRole === 'ADMIN' ? 'Admin' : 'Thủ kho'} nhập thêm ${addedQty} ${duplicate.unit} vào mã ${duplicate.code} (${floorLabel(targetFloor)}) trên CMS`,
        } as any);
      }
      return {
        __upserted: true,
        data: updated,
        meta: { upserted: true, addedQuantity: addedQty, targetWarehouse: targetFloor },
      };
    }
    throw new ApiError(
      409,
      'PRODUCT_DUPLICATE',
      `Đã có sản phẩm "${duplicate.name}" (mã ${duplicate.code}) cùng Danh mục + Thương hiệu + Version. Chọn "thêm biến thể vào sản phẩm này".`,
      { existingProductId: String(duplicate._id), existingProductCode: duplicate.code }
    );
  }

  const price = parseMoneyField(body.sellingPrice, 'sellingPrice', 'INVALID_PRICE', 'Giá bán') ?? 0;
  const cost = parseMoneyField(body.costPrice, 'costPrice', 'INVALID_COST_PRICE', 'Giá gốc') ?? 0;

  const rawVariants: any[] =
    Array.isArray(body.variants) && body.variants.length > 0
      ? body.variants
      : body.color !== undefined || body.size !== undefined
      ? [{ color: body.color, colorCode: body.colorCode, size: body.size, colorHexes: body.colorHexes, quantity: body.quantity }]
      : [];
  const prepared = prepareSchemeVariants(code, rawVariants);

  const variantRecords = prepared.map((v) => {
    const qty = Math.max(0, Math.round(Number(v.quantity ?? v.stock ?? 0)) || 0);
    const f1 =
      v.stockFloor1 !== undefined ? Math.max(0, Math.round(Number(v.stockFloor1) || 0)) : targetFloor === 'FLOOR_1' ? qty : 0;
    const f2 =
      v.stockFloor2 !== undefined ? Math.max(0, Math.round(Number(v.stockFloor2) || 0)) : targetFloor === 'FLOOR_2' ? qty : 0;
    const vSelling = parseMoneyField(v.sellingPrice, 'variants.sellingPrice', 'INVALID_PRICE', 'Giá bán biến thể');
    const vCost = parseMoneyField(v.costPrice, 'variants.costPrice', 'INVALID_COST_PRICE', 'Giá gốc biến thể');
    return {
      variantKey: v.variantKey,
      color: v.color,
      colorCode: v.colorCode || undefined,
      colorHexes: sanitizeColorHexes(v.colorHexes),
      size: v.size,
      variantCode: v.variantCode,
      barcode: v.variantCode,
      ...(vSelling !== undefined ? { sellingPrice: vSelling } : {}),
      ...(vCost !== undefined ? { costPrice: vCost } : {}),
      stockFloor1: f1,
      stockFloor2: f2,
      stock: f1 + f2,
    };
  });

  assertPricePermission(
    req.user?.role,
    [price, ...variantRecords.map((v: any) => v.sellingPrice || 0)],
    [cost, ...variantRecords.map((v: any) => v.costPrice || 0)]
  );

  const conflicts = await findCodeConflicts([code, ...variantRecords.map((v) => v.variantCode)]);
  if (conflicts.length > 0) {
    throw new ApiError(
      409,
      'CODE_CONFLICT',
      `Mã ${conflicts[0].code} đã được dùng bởi sản phẩm ${conflicts[0].productCode}. Vui lòng sửa mã Version/mã màu.`,
      { code: conflicts[0].code, conflictProductId: conflicts[0].productId, versionCode: 'Đổi mã Version' }
    );
  }

  const summary =
    variantRecords.length > 0
      ? summarizeVariants(variantRecords, code, { newScheme: true })
      : (() => {
          const qty = Math.max(0, Math.round(Number(body.quantity) || 0));
          return {
            variants: [],
            stockFloor1: targetFloor === 'FLOOR_1' ? qty : 0,
            stockFloor2: targetFloor === 'FLOOR_2' ? qty : 0,
            stock: qty,
          };
        })();
  if (summary.stock > 0 && !isPriceManager(req.user?.role)) {
    throw new ApiError(403, 'DIRECT_STOCK_FORBIDDEN', 'Chỉ Quản lý/Admin mới được nhập thẳng số lượng sản phẩm vào kho');
  }

  const cleanParentSetId = body.parentSetProductId ? String(body.parentSetProductId).trim() : '';
  const name = String(body.name || '').trim() || `${brand.isSystem ? '' : brand.name + ' '}${version.versionName}`.trim();
  const unit = body.unit ? String(body.unit).trim() : 'Cái';

  let created: any;
  try {
    created = await productRepo.create({
      code,
      barcode: code,
      name,
      brand: brand.isSystem ? '' : brand.name,
      brandId: String(brand._id),
      brandCode: brand.code,
      brandName: brand.isSystem ? '' : brand.name,
      versionName: version.versionName,
      versionCode: version.versionCode,
      modelName: '',
      categoryId: String(category._id),
      categoryCode: category.code,
      categoryName: category.name,
      unit,
      sellingPrice: price,
      costPrice: cost,
      variants: summary.variants,
      stockFloor1: summary.stockFloor1,
      stockFloor2: summary.stockFloor2,
      stock: summary.stock,
      parentSetProductId: cleanParentSetId,
      packSize: cleanParentSetId ? Math.max(0, Math.round(Number(body.packSize) || 0)) : 0,
      note: body.note !== undefined ? String(body.note).trim() : '',
      status: 'ACTIVE',
    } as any);
  } catch (e: any) {
    if (e?.code === 11000) {
      throw new ApiError(409, 'PRODUCT_DUPLICATE', 'Sản phẩm cùng Danh mục + Thương hiệu + Version đã tồn tại', {
        versionCode: 'Trùng',
      });
    }
    throw e;
  }

  if (summary.stock > 0) {
    const actorId = req.user?.userId || 'ADMIN';
    const actorName = req.user?.fullName || 'Quản lý kho (CMS)';
    const actorRole = inferActorRole(req.user?.role, actorId, actorName);
    const movementTargets =
      summary.variants.length > 0 ? summary.variants.filter((v: any) => v.stock > 0) : [{ color: '', size: '', stock: summary.stock }];
    let running = 0;
    for (const v of movementTargets as any[]) {
      await stockMovementRepo.create({
        type: 'IMPORT',
        productId: created._id,
        productCode: created.code,
        productName: formatProductWithVariant(created.name, v.color, v.size),
        color: v.color,
        size: v.size,
        categoryId: created.categoryId,
        unit: created.unit,
        quantityChange: v.stock,
        balanceBefore: running,
        balanceAfter: running + v.stock,
        warehouseLocation: targetFloor,
        referenceType: 'IMPORT_RECEIPT',
        referenceId: created._id,
        referenceCode: 'CMS-NHAP-THANG',
        performedBy: actorId,
        performedByName: actorName,
        performedByRole: actorRole,
        note: `${actorRole === 'ADMIN' ? 'Admin' : 'Thủ kho'} nhập thẳng sản phẩm mới ${created.code} trên CMS (${v.stock} ${created.unit})`,
      } as any);
      running += v.stock;
    }
  }
  return created;
}

// POST /api/v1/products/:id/variants (v5.0) — thêm biến thể vào sản phẩm có sẵn (hỗ trợ kèm tồn kho cho CEO/ADMIN)
productsInventoryRouter.post('/products/:id/variants', async (req, res, next) => {
  try {
    if (!isPriceManager(req.user?.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản lý/Admin/Kế toán kho mới được thêm biến thể');
    }
    const product = await productRepo.findById(req.params.id);
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm');
    const raw: any[] = Array.isArray(req.body?.variants) ? req.body.variants : [];
    if (raw.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Danh sách biến thể trống', { variants: 'Bắt buộc' });
    }
    const defaultFloor = normalizeFloor(req.body?.targetWarehouse);
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
    if (totalAddedStock > 0 && req.user?.role !== 'CEO' && req.user?.role !== 'ADMIN') {
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
      const actorId = req.user?.userId || 'ADMIN';
      const actorName = req.user?.fullName || 'Quản lý kho (CMS)';
      const actorRole = inferActorRole(req.user?.role, actorId, actorName);
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

    res.json({ data: updated, meta: { addedVariants: additions.length, addedQuantity: totalAddedStock } });
  } catch (err) {
    next(err);
  }
});

/**
 * v5.0: Cập nhật thuộc tính (color, size, colorCode, giá, màu Hex, tồn) của danh sách biến thể.
 * Trên sản phẩm mã mới, khi sửa color / size / colorCode làm đổi variantCode:
 * - Sinh lại variantCode theo scheme mới (Mã gốc + ColorCode + SizeCode).
 * - Đẩy variantCode cũ vào legacyVariantCodes (và gán legacyVariantCode nếu chưa có) để tem cũ vẫn quét được.
 */
async function buildPatchedVariantsForProduct(
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
productsInventoryRouter.patch('/products/:id/variants', async (req, res, next) => {
  try {
    if (!isPriceManager(req.user?.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản lý/Admin/Kế toán kho mới được cập nhật biến thể');
    }
    const product = await productRepo.findById(req.params.id);
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm');

    const body = req.body || {};
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
      role: req.user?.role,
    });

    const updated = await productRepo.updateById(String(product._id), {
      variants: sum.variants,
      stockFloor1: sum.stockFloor1,
      stockFloor2: sum.stockFloor2,
      stock: sum.stock,
    } as any);
    const updatedFloors = getFloorStocks(updated);
    res.json({
      data: {
        ...updated,
        variants: updatedFloors.variants,
        stockFloor1: updatedFloors.stockFloor1,
        stockFloor2: updatedFloors.stockFloor2,
        stock: updatedFloors.stock,
      },
      meta: { updatedVariants: rawPatches.length },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/products/:id
productsInventoryRouter.patch('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productRepo.findById(id);
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm');
    }

    const {
      code,
      stock,
      stockFloor1,
      stockFloor2,
      variants: rawVariants,
      allowDirectStock,
      name,
      brand,
      modelName,
      categoryId,
      unit,
      sellingPrice,
      costPrice,
      status,
      parentSetProductId,
      packSize,
      brandId,
      versionCode,
      versionName,
      variantPrices,
      allowRecode,
      note,
    } = req.body || {};

    // v5.0: Brand/Version nằm trong mã sản phẩm => không được đổi sau khi tạo trừ khi truyền allowRecode: true
    const productAny = product as any;
    if (
      !allowRecode &&
      ((brandId !== undefined && productAny.brandId && String(brandId) !== String(productAny.brandId)) ||
        (versionCode !== undefined &&
          productAny.versionCode &&
          String(versionCode).trim().toUpperCase() !== String(productAny.versionCode)))
    ) {
      throw new ApiError(
        400,
        'PRODUCT_CODE_IMMUTABLE',
        'Thương hiệu / mã Version nằm trong mã sản phẩm, không được sửa sau khi tạo',
        { versionCode: 'Không được sửa' }
      );
    }

    // BR-03: Mã sản phẩm không được sửa trực tiếp sau khi tạo
    if (!allowRecode && code !== undefined && String(code).toUpperCase() !== product.code) {
      throw new ApiError(
        400,
        'PRODUCT_CODE_IMMUTABLE',
        'Mã sản phẩm là duy nhất và không được phép sửa sau khi tạo',
        { code: 'Không được phép sửa mã sản phẩm' }
      );
    }

    const updateData: Record<string, any> = {};
    let stockDelta = 0;
    let deltaFloor1 = 0;
    let deltaFloor2 = 0;
    const currentFloors = getFloorStocks(product);
    const balanceBefore = currentFloors.stock;

    // Nếu truyền allowRecode hoặc cập nhật brandId + versionName/versionCode cho sản phẩm (cũ hoặc mới)
    const wantsSchemeUpdate =
      Boolean(allowRecode) &&
      Boolean(brandId || productAny.brandId) &&
      Boolean(versionName || versionCode || productAny.versionName || productAny.versionCode);
    let workingProductForVariants: any = product;

    if (wantsSchemeUpdate) {
      if (!isPriceManager(req.user?.role)) {
        throw new ApiError(403, 'FORBIDDEN', 'Chỉ Quản lý/Admin/Kế toán mới được sửa cấu trúc mã sản phẩm');
      }
      const targetCatId = String(categoryId || product.categoryId);
      const targetBrandId = String(brandId || productAny.brandId);
      const { category: catObj, brand: brandObj, categoryCode: cateCode } = await resolveCategoryAndBrand(
        targetCatId,
        targetBrandId
      );
      const bCode = String(brandObj.code || '');
      const ver = resolveVersionCode(
        versionName !== undefined ? versionName : productAny.versionName || product.name,
        versionCode !== undefined ? versionCode : productAny.versionCode
      );
      const dup = await findDuplicateProduct(
        String(catObj._id),
        String(brandObj._id),
        ver.versionCode,
        String(product._id)
      );
      if (dup) {
        throw new ApiError(
          409,
          'PRODUCT_DUPLICATE',
          `Đã có sản phẩm cùng Danh mục + Thương hiệu + Version (${dup.code} - ${dup.name})`,
          {
            existingProductId: String(dup._id),
            existingProductCode: String(dup.code),
          }
        );
      }
      const nextRootCode = buildSchemeRootCode(cateCode, bCode, ver.versionCode);
      const rootConflicts = await findCodeConflicts([nextRootCode], String(product._id));
      if (rootConflicts.length > 0) {
        throw new ApiError(
          409,
          'CODE_CONFLICT',
          `Mã gốc "${nextRootCode}" bị trùng với sản phẩm khác (${rootConflicts[0].productCode})`,
          { code: nextRootCode }
        );
      }
      updateData.categoryId = String(catObj._id);
      updateData.categoryCode = catObj.code;
      updateData.categoryName = catObj.name;
      updateData.brandId = String(brandObj._id);
      updateData.brandCode = bCode;
      updateData.brandName = brandObj.name;
      updateData.brand = brandObj.isSystem ? '' : brandObj.name;
      updateData.versionName = ver.versionName;
      updateData.versionCode = ver.versionCode;
      if (nextRootCode !== product.code) {
        const legSet = new Set<string>(Array.isArray(productAny.legacyCodes) ? productAny.legacyCodes : []);
        if (productAny.legacyCode) legSet.add(String(productAny.legacyCode));
        if (product.code) legSet.add(String(product.code));
        updateData.legacyCode = productAny.legacyCode || product.code;
        updateData.legacyCodes = Array.from(legSet);
        updateData.code = nextRootCode;
        updateData.barcode = nextRootCode;
      }
      workingProductForVariants = {
        ...productAny,
        ...updateData,
        _id: product._id,
        code: nextRootCode,
      };
    }

    // BR-05: Chỉ cho phép Admin sửa trực tiếp tồn kho từ CMS khi truyền allowDirectStock = true
    const hasVariantsEdit = Array.isArray(rawVariants);
    const hasFloorEdit = stockFloor1 !== undefined || stockFloor2 !== undefined;
    const hasStockEdit = stock !== undefined && Number(stock) !== balanceBefore;

    if (hasVariantsEdit || hasFloorEdit || hasStockEdit) {
      if (!allowDirectStock) {
        throw new ApiError(
          400,
          'STOCK_DIRECT_EDIT_FORBIDDEN',
          'Không được sửa trực tiếp tồn kho; vui lòng dùng Nhập kho hoặc Phiếu điều chỉnh kho',
          { stock: 'Không được sửa tay tồn kho' }
        );
      }
      if (!isPriceManager(req.user?.role)) {
        throw new ApiError(
          403,
          'DIRECT_STOCK_FORBIDDEN',
          'Chỉ Quản lý/Admin mới được cập nhật số lượng kho trực tiếp'
        );
      }

      if (hasVariantsEdit) {
        const sum = await buildPatchedVariantsForProduct(
          workingProductForVariants,
          currentFloors.variants,
          rawVariants as any[],
          {
            partial: false,
            role: req.user?.role,
          }
        );
        deltaFloor1 = sum.stockFloor1 - currentFloors.stockFloor1;
        deltaFloor2 = sum.stockFloor2 - currentFloors.stockFloor2;
        stockDelta = sum.stock - balanceBefore;
        updateData.variants = sum.variants;
        updateData.stockFloor1 = sum.stockFloor1;
        updateData.stockFloor2 = sum.stockFloor2;
        updateData.stock = sum.stock;
      } else if (hasFloorEdit) {
        const nextF1 =
          stockFloor1 !== undefined ? Math.round(Number(stockFloor1)) : currentFloors.stockFloor1;
        const nextF2 =
          stockFloor2 !== undefined ? Math.round(Number(stockFloor2)) : currentFloors.stockFloor2;
        if (isNaN(nextF1) || nextF1 < 0 || isNaN(nextF2) || nextF2 < 0) {
          throw new ApiError(400, 'INVALID_QUANTITY', 'Số lượng tồn kho từng tầng phải là số nguyên không âm');
        }
        const newStock = nextF1 + nextF2;
        deltaFloor1 = nextF1 - currentFloors.stockFloor1;
        deltaFloor2 = nextF2 - currentFloors.stockFloor2;
        stockDelta = newStock - balanceBefore;
        updateData.stockFloor1 = nextF1;
        updateData.stockFloor2 = nextF2;
        updateData.stock = newStock;
        if (currentFloors.variants.length === 1) {
          updateData.variants = [
            {
              ...currentFloors.variants[0],
              stockFloor1: nextF1,
              stockFloor2: nextF2,
              stock: newStock,
            },
          ];
        }
      } else {
        const newStock = Math.round(Number(stock));
        if (isNaN(newStock) || newStock < 0) {
          throw new ApiError(400, 'INVALID_QUANTITY', 'Số lượng tồn kho phải là số nguyên không âm');
        }
        stockDelta = newStock - balanceBefore;
        let nextF1 = currentFloors.stockFloor1 + stockDelta;
        let nextF2 = currentFloors.stockFloor2;
        if (nextF1 < 0) {
          nextF2 = Math.max(0, nextF2 + nextF1);
          nextF1 = 0;
        }
        deltaFloor1 = nextF1 - currentFloors.stockFloor1;
        deltaFloor2 = nextF2 - currentFloors.stockFloor2;
        updateData.stockFloor1 = nextF1;
        updateData.stockFloor2 = nextF2;
        updateData.stock = newStock;
        if (currentFloors.variants.length === 1) {
          updateData.variants = [
            {
              ...currentFloors.variants[0],
              stockFloor1: nextF1,
              stockFloor2: nextF2,
              stock: newStock,
            },
          ];
        }
      }
    }

    if (name !== undefined && String(name).trim()) {
      updateData.name = String(name).trim();
    }
    if (brand !== undefined && !productAny.brandId) {
      updateData.brand = String(brand).trim();
    }
    if (versionName !== undefined && productAny.versionCode) {
      const vn = String(versionName).trim();
      if (!vn) throw new ApiError(400, 'VALIDATION_ERROR', 'Version không được để trống', { versionName: 'Bắt buộc' });
      updateData.versionName = vn;
    }

    // v5.0: sửa giá riêng của biến thể (không chạm tồn kho)
    if (Array.isArray(variantPrices) && variantPrices.length > 0) {
      const baseVariants: any[] = (updateData.variants || currentFloors.variants).map((v: any) => ({ ...v }));
      for (const vp of variantPrices) {
        const target = baseVariants.find(
          (v) =>
            (vp?.variantKey && v.variantKey === vp.variantKey) ||
            (vp?.variantCode &&
              normalizeToCompactUpperCode(String(v.variantCode || '')) ===
                normalizeToCompactUpperCode(String(vp.variantCode)))
        );
        if (!target) {
          throw new ApiError(404, 'VARIANT_NOT_FOUND', `Không tìm thấy biến thể ${vp?.variantCode || vp?.variantKey || ''}`);
        }
        if (vp.sellingPrice !== undefined) {
          const sp = parseMoneyField(vp.sellingPrice, 'sellingPrice', 'INVALID_PRICE', 'Giá bán biến thể') ?? 0;
          if (sp !== Math.round(Number(target.sellingPrice) || 0) && !canEditSellingPrice(req.user?.role)) {
            throw new ApiError(403, 'SELLING_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin hoặc Thủ kho mới được cập nhật giá bán');
          }
          target.sellingPrice = sp;
        }
        if (vp.costPrice !== undefined) {
          const cp = parseMoneyField(vp.costPrice, 'costPrice', 'INVALID_COST_PRICE', 'Giá gốc biến thể') ?? 0;
          if (cp !== Math.round(Number(target.costPrice) || 0) && !isPriceManager(req.user?.role)) {
            throw new ApiError(403, 'COST_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được sửa giá gốc');
          }
          target.costPrice = cp;
        }
      }
      updateData.variants = summarizeVariants(baseVariants, workingProductForVariants.code, {
        newScheme: isNewSchemeProduct(workingProductForVariants),
      }).variants;
    } else if (wantsSchemeUpdate && !hasVariantsEdit && currentFloors.variants.length > 0) {
      const sum = await buildPatchedVariantsForProduct(
        workingProductForVariants,
        currentFloors.variants,
        currentFloors.variants as any[],
        {
          partial: false,
          role: req.user?.role,
        }
      );
      updateData.variants = sum.variants;
    }
    if (modelName !== undefined) {
      updateData.modelName = String(modelName).trim();
    }
    if (note !== undefined) {
      updateData.note = String(note || '').trim();
    }
    if (categoryId !== undefined && !wantsSchemeUpdate) {
      const cat = await categoryRepo.findById(String(categoryId));
      if (!cat) {
        throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'Danh mục không tồn tại');
      }
      if (!allowRecode && isNewSchemeProduct(product) && String(cat._id) !== String(product.categoryId)) {
        const oldCat = await categoryRepo.findById(String(product.categoryId));
        if (!oldCat?.skuCode || oldCat.skuCode !== cat.skuCode) {
          throw new ApiError(
            400,
            'PRODUCT_CODE_IMMUTABLE',
            'Danh mục nằm trong mã sản phẩm, không được đổi sang danh mục có mã viết tắt khác',
            { categoryId: 'Không được đổi' }
          );
        }
      }
      updateData.categoryId = cat._id;
      updateData.categoryCode = cat.code;
      updateData.categoryName = cat.name;

      // Đồng bộ chữ cái đầu tiên của Category trong Mã sản phẩm khi đổi danh mục (chỉ sản phẩm legacy)
      const nextCode = isNewSchemeProduct(product) ? product.code : generateProductCode(updateData.name || product.name, {
        categoryCode: cat.code,
        categoryName: cat.name,
        brand: updateData.brand !== undefined ? updateData.brand : product.brand,
        existingCode: product.code,
      });
      if (nextCode && nextCode !== product.code) {
        const conflict = await productRepo.findOne({ code: nextCode });
        if (!conflict || String(conflict._id) === String(product._id)) {
          updateData.code = nextCode;
          updateData.barcode = nextCode;
          const variantsSource = updateData.variants || currentFloors.variants;
          if (Array.isArray(variantsSource) && variantsSource.length > 0) {
            updateData.variants = summarizeVariants(variantsSource, nextCode).variants;
          }
        }
      }
    }
    if (unit !== undefined && String(unit).trim()) {
      updateData.unit = String(unit).trim();
    }
    if (sellingPrice !== undefined) {
      const price = Math.round(Number(sellingPrice));
      if (isNaN(price) || price < 0) {
        throw new ApiError(400, 'INVALID_PRICE', 'Giá bán phải là số nguyên không âm');
      }
      if (price !== product.sellingPrice && !canEditSellingPrice(req.user?.role)) {
        throw new ApiError(403, 'SELLING_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin hoặc Thủ kho mới được cập nhật giá bán');
      }
      updateData.sellingPrice = price;
    }
    if (costPrice !== undefined) {
      const cost = Math.round(Number(costPrice));
      if (isNaN(cost) || cost < 0) {
        throw new ApiError(400, 'INVALID_COST_PRICE', 'Giá gốc phải là số nguyên không âm');
      }
      if (cost !== (product.costPrice || 0) && !isPriceManager(req.user?.role)) {
        throw new ApiError(403, 'COST_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được sửa giá gốc');
      }
      updateData.costPrice = cost;
    }
    if (status !== undefined && ['ACTIVE', 'INACTIVE'].includes(status)) {
      updateData.status = status;
    }
    if (parentSetProductId !== undefined) {
      const cleanParentId = String(parentSetProductId || '').trim();
      if (cleanParentId && cleanParentId === String(product._id)) {
        throw new ApiError(
          400,
          'INVALID_SET_LINK',
          'Sản phẩm lẻ không thể tự liên kết làm Sản phẩm Bộ của chính nó'
        );
      }
      if (cleanParentId) {
        const parentProd = await productRepo.findById(cleanParentId);
        if (!parentProd) {
          throw new ApiError(404, 'SET_PRODUCT_NOT_FOUND', 'Không tìm thấy Sản phẩm Bộ/Hộp gốc cần liên kết');
        }
      }
      updateData.parentSetProductId = cleanParentId;
      if (!cleanParentId) {
        updateData.packSize = 0;
      }
    }
    if (packSize !== undefined) {
      const parsedPack = Math.max(0, Math.round(Number(packSize) || 0));
      const effectiveParentId =
        updateData.parentSetProductId !== undefined
          ? updateData.parentSetProductId
          : String(product.parentSetProductId || '').trim();
      updateData.packSize = effectiveParentId ? parsedPack : 0;
    }

    const updated = await productRepo.updateById(id, updateData);

    // Đồng bộ toàn bộ 6 bảng lịch sử (orders, stockmovements, importreceipts, returnexchanges, promotions, shifthandovers) nếu mã gốc đổi
    if (updated && updated.code !== product.code) {
      await syncProductReferencesAfterRecode(product, updated);
    }

    // Đồng bộ tên / đơn vị / category lên các bút toán Sổ kho liên quan nếu có thay đổi
    if (
      updated &&
      (updateData.name !== undefined ||
        updateData.unit !== undefined ||
        updateData.categoryId !== undefined)
    ) {
      const relatedMovements = await stockMovementRepo.find({ productId: String(updated._id) });
      for (const m of relatedMovements) {
        await stockMovementRepo.updateById(m._id, {
          productName: formatProductWithVariant(updated.name, m.color, m.size),
          unit: updated.unit,
          categoryId: updated.categoryId,
        });
      }
    }

    if ((deltaFloor1 !== 0 || deltaFloor2 !== 0) && updated) {
      const actorId = req.user?.userId || 'ADMIN';
      const actorName = req.user?.fullName || 'Quản lý kho (CMS)';
      const actorRole = inferActorRole(req.user?.role, actorId, actorName);
      let runningBalance = balanceBefore;

      const floorChanges: { floor: 'FLOOR_1' | 'FLOOR_2'; delta: number }[] = [];
      if (deltaFloor1 !== 0) floorChanges.push({ floor: 'FLOOR_1', delta: deltaFloor1 });
      if (deltaFloor2 !== 0) floorChanges.push({ floor: 'FLOOR_2', delta: deltaFloor2 });

      for (const fc of floorChanges) {
        const isImport = fc.delta > 0;
        const nextBalance = runningBalance + fc.delta;
        await stockMovementRepo.create({
          type: isImport ? 'IMPORT' : 'ADJUSTMENT',
          productId: updated._id,
          productCode: updated.code,
          productName: updated.name,
          categoryId: updated.categoryId,
          unit: updated.unit,
          quantityChange: fc.delta,
          balanceBefore: runningBalance,
          balanceAfter: nextBalance,
          warehouseLocation: fc.floor,
          referenceType: isImport ? 'IMPORT_RECEIPT' : 'ADJUSTMENT',
          referenceId: updated._id,
          referenceCode: isImport ? 'CMS-NHAP-THANG' : 'CMS-DIEU-CHINH',
          performedBy: actorId,
          performedByName: actorName,
          performedByRole: actorRole,
          note: isImport
            ? `[${floorLabel(fc.floor)}] ${actorRole === 'ADMIN' ? 'Admin' : 'Thủ kho'} nhập thêm ${fc.delta} ${updated.unit} trực tiếp trên CMS`
            : `[${floorLabel(fc.floor)}] ${actorRole === 'ADMIN' ? 'Admin' : 'Thủ kho'} điều chỉnh giảm ${Math.abs(fc.delta)} ${updated.unit} trực tiếp trên CMS`,
        });
        runningBalance = nextBalance;
      }
    }

    const updatedFloors = getFloorStocks(updated);
    res.json({
      data: {
        ...updated,
        variants: updatedFloors.variants,
        stockFloor1: updatedFloors.stockFloor1,
        stockFloor2: updatedFloors.stockFloor2,
        stock: updatedFloors.stock,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/products/:id
productsInventoryRouter.delete('/products/:id', async (req, res, next) => {
  try {
    if (!isPriceManager(req.user?.role)) {
      throw new ApiError(403, 'PRODUCT_DELETE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được xóa sản phẩm');
    }

    const { id } = req.params;
    const product = await productRepo.findById(id);
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm cần xóa');
    }

    const movements = await stockMovementRepo.find({ productId: String(product._id) });
    for (const m of movements) {
      await stockMovementRepo.deleteById(m._id);
    }

    await productRepo.deleteById(product._id);

    res.json({
      data: {
        deleted: true,
        _id: product._id,
        code: product.code,
        name: product.name,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/movements
productsInventoryRouter.get('/inventory/movements', async (req, res, next) => {
  try {
    const { productId, type, from, to, search } = req.query;
    const [movements, allProducts, staffRoleMap] = await Promise.all([
      stockMovementRepo.find({}, { createdAt: -1 }),
      productRepo.find({}),
      buildStaffRoleMap(),
    ]);

    const hideCost = req.user?.role === 'SALES';
    const prodById = new Map(allProducts.map((p) => [String(p._id), p]));
    const prodByCode = new Map(allProducts.map((p) => [String(p.code), p]));

    const fromDate = from ? new Date(String(from)) : null;
    if (fromDate) fromDate.setHours(0, 0, 0, 0);

    const toDate = to ? new Date(String(to)) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const baseMovements = movements
      .filter((m) => {
        if (productId && String(m.productId) !== String(productId)) return false;
        if (type && m.type !== String(type).toUpperCase()) return false;
        const mTime = new Date(m.createdAt).getTime();
        if (fromDate && mTime < fromDate.getTime()) return false;
        if (toDate && mTime > toDate.getTime()) return false;
        return true;
      })
      .map((m) => {
        const prod = prodById.get(String(m.productId)) || prodByCode.get(String(m.productCode));
        const defaultFallbackRole =
          m.type === 'SALE' || m.type === 'RETURN' || m.type === 'EXCHANGE_IN' || m.type === 'EXCHANGE_OUT'
            ? 'SALES'
            : String(m.referenceCode || '').startsWith('PN-')
            ? 'ACCOUNTANT'
            : 'ADMIN';
        const performedByRole = inferActorRole(
          (m as any).performedByRole,
          m.performedBy,
          m.performedByName,
          staffRoleMap,
          defaultFallbackRole
        );
        return {
          ...(m as any),
          performedByRole,
          sellingPrice: Number(prod?.sellingPrice || 0),
          currentStock: Number(prod?.stock ?? m.balanceAfter ?? 0),
          ...(hideCost ? {} : { costPrice: Number(prod?.costPrice || 0) }),
        };
      });

    const filtered = search
      ? filterAndRankBySearch(baseMovements, String(search), (m) => [
          { text: m.productCode, weight: 1.5 },
          { text: m.referenceCode, weight: 1.4 },
          { text: m.productName, weight: 1.3 },
          { text: m.color, weight: 0.9 },
          { text: m.size, weight: 0.9 },
          { text: m.performedByName, weight: 0.9 },
          { text: m.type, weight: 0.8 },
          { text: m.note, weight: 0.8 },
        ])
      : baseMovements;

    res.json({
      data: filtered,
      meta: { total: filtered.length },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/report
productsInventoryRouter.get('/inventory/report', async (req, res, next) => {
  try {
    const { from, to, categoryId, search } = req.query;
    const hideCost = req.user?.role === 'SALES';

    const fromDate = from ? new Date(String(from)) : new Date(0);
    if (from) fromDate.setHours(0, 0, 0, 0);

    const toDate = to ? new Date(String(to)) : new Date();
    if (to) toDate.setHours(23, 59, 59, 999);

    const allProducts = await productRepo.find({}, { createdAt: 1 });
    const allMovements = await stockMovementRepo.find({}, { createdAt: 1 });

    const baseProducts = allProducts.filter((p) => {
      if (categoryId && String(p.categoryId) !== String(categoryId)) return false;
      return true;
    });

    const searchedProducts = search
      ? filterAndRankBySearch(baseProducts, String(search), (p) => [
          { text: p.code, weight: 1.5 },
          { text: p.name, weight: 1.3 },
          { text: p.categoryName, weight: 0.9 },
          { text: p.categoryCode, weight: 0.9 },
        ])
      : baseProducts;

    const reportRows = searchedProducts.map((product) => {
      const pMovements = allMovements.filter(
        (m) => String(m.productId) === String(product._id)
      );

      let openingStock = 0;
      let importedQty = 0;
      let soldQty = 0;
      let adjustedAndReturnedQty = 0;

      for (const m of pMovements) {
        if (m.type === 'TRANSFER') continue;
        const mTime = new Date(m.createdAt).getTime();
        if (mTime < fromDate.getTime()) {
          openingStock += m.quantityChange;
        } else if (mTime <= toDate.getTime()) {
          if (m.type === 'IMPORT') {
            importedQty += m.quantityChange;
          } else if (m.type === 'SALE') {
            soldQty += Math.abs(m.quantityChange);
          } else {
            adjustedAndReturnedQty += m.quantityChange;
          }
        }
      }

      const closingStock =
        openingStock + importedQty - soldQty + adjustedAndReturnedQty;
      const floors = getFloorStocks(product);

      return {
        productId: product._id,
        productCode: product.code,
        productName: product.name,
        variants: floors.variants,
        categoryId: product.categoryId,
        categoryCode: product.categoryCode,
        categoryName: product.categoryName,
        unit: product.unit,
        sellingPrice: Number(product.sellingPrice || 0),
        ...(hideCost ? {} : { costPrice: Number(product.costPrice || 0) }),
        openingStock,
        importedQty,
        soldQty,
        adjustedAndReturnedQty,
        closingStock,
        currentStock: floors.stock,
        stockFloor1: floors.stockFloor1,
        stockFloor2: floors.stockFloor2,
      };
    });

    const summary = reportRows.reduce(
      (acc, r) => {
        acc.totalOpeningStock += r.openingStock;
        acc.totalImportedQty += r.importedQty;
        acc.totalSoldQty += r.soldQty;
        acc.totalAdjustedAndReturnedQty += r.adjustedAndReturnedQty;
        acc.totalClosingStock += r.closingStock;
        return acc;
      },
      {
        totalOpeningStock: 0,
        totalImportedQty: 0,
        totalSoldQty: 0,
        totalAdjustedAndReturnedQty: 0,
        totalClosingStock: 0,
      }
    );

    res.json({
      data: reportRows,
      meta: {
        from: from || null,
        to: to || null,
        summary,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/adjustments
productsInventoryRouter.post('/inventory/adjustments', async (req, res, next) => {
  try {
    const { productId, quantityChange, reason, warehouse, color, size } = req.body || {};
    if (!productId || quantityChange === undefined || !reason || !String(reason).trim()) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Vui lòng chọn sản phẩm, nhập số lượng điều chỉnh và lý do điều chỉnh kho',
        {
          productId: !productId ? 'Bắt buộc' : '',
          quantityChange: quantityChange === undefined ? 'Bắt buộc' : '',
          reason: !reason ? 'Lý do bắt buộc' : '',
        }
      );
    }

    const delta = Math.round(Number(quantityChange));
    if (isNaN(delta) || delta === 0) {
      throw new ApiError(400, 'INVALID_QUANTITY_CHANGE', 'Số lượng điều chỉnh phải là số nguyên khác 0');
    }

    const product = await productRepo.findById(String(productId));
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm cần điều chỉnh');
    }

    const cleanColor = color ? String(color).trim() : '';
    const cleanSize = size ? String(size).trim().toUpperCase() : '';
    const targetFloor = normalizeFloor(warehouse);
    const floors = getFloorStocks(product);
    const variantFloors = getVariantFloorStocks(product, cleanColor, cleanSize);
    const balanceBefore = floors.stock;
    const balanceAfter = balanceBefore + delta;
    if (balanceAfter < 0) {
      throw new ApiError(
        400,
        'INSUFFICIENT_STOCK_FOR_ADJUSTMENT',
        `Tồn kho sau điều chỉnh không được âm (Tồn hiện tại: ${balanceBefore}, điều chỉnh: ${delta})`
      );
    }

    if (
      (targetFloor === 'FLOOR_1' && variantFloors.stockFloor1 + delta < 0) ||
      (targetFloor === 'FLOOR_2' && variantFloors.stockFloor2 + delta < 0)
    ) {
      const targetCurrent = targetFloor === 'FLOOR_1' ? variantFloors.stockFloor1 : variantFloors.stockFloor2;
      throw new ApiError(
        400,
        'INSUFFICIENT_FLOOR_STOCK_FOR_ADJUSTMENT',
        `Tồn ${floorLabel(targetFloor)} không đủ để giảm ${Math.abs(delta)} (Hiện có: ${targetCurrent})`
      );
    }

    const floorResult = applyFloorDelta(product, targetFloor, delta, cleanColor, cleanSize);

    await productRepo.updateById(product._id, {
      variants: floorResult.variants,
      stockFloor1: floorResult.stockFloor1,
      stockFloor2: floorResult.stockFloor2,
      stock: floorResult.stock,
    });

    const adjCount = await stockMovementRepo.countDocuments({ type: 'ADJUSTMENT' });
    const referenceCode = `DC-${String(adjCount + 1).padStart(4, '0')}`;
    const adjActorId = req.user?.userId || 'ADMIN';
    const adjActorName = req.user?.fullName || 'Quản lý kho';
    const adjActorRole = inferActorRole(req.user?.role, adjActorId, adjActorName);

    const movement = await stockMovementRepo.create({
      type: 'ADJUSTMENT',
      productId: product._id,
      productCode: product.code,
      productName: formatProductWithVariant(product.name, cleanColor, cleanSize),
      color: cleanColor,
      size: cleanSize,
      categoryId: product.categoryId,
      unit: product.unit,
      quantityChange: delta,
      balanceBefore,
      balanceAfter: floorResult.stock,
      warehouseLocation: targetFloor,
      referenceType: 'ADJUSTMENT',
      referenceId: product._id,
      referenceCode,
      performedBy: adjActorId,
      performedByName: adjActorName,
      performedByRole: adjActorRole,
      note: `[${floorLabel(targetFloor)}] ${String(reason).trim()}`,
    });

    const updatedProduct = await productRepo.findById(product._id);

    res.status(201).json({
      data: {
        movement,
        product: updatedProduct,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/unpack-set
productsInventoryRouter.post('/inventory/unpack-set', async (req, res, next) => {
  try {
    const { retailProductId, setsToUnpack = 1, warehouse = 'FLOOR_1', color, size, reason } = req.body || {};
    if (!retailProductId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng chọn sản phẩm lẻ cần tách bộ', {
        retailProductId: 'Bắt buộc',
      });
    }

    const actorId = req.user?.userId || 'ADMIN';
    const actorName = req.user?.fullName || 'Quản lý kho';
    const actorRole = inferActorRole(req.user?.role, actorId, actorName);

    const result = await executeUnpackSetToRetail({
      retailProductId: String(retailProductId),
      setsToUnpack: Number(setsToUnpack) || 1,
      warehouse: normalizeFloor(warehouse),
      color: color ? String(color).trim() : '',
      size: size ? String(size).trim().toUpperCase() : '',
      reason: reason ? String(reason).trim() : 'Tách sản phẩm bộ sang lẻ 1 chạm',
      actorId,
      actorName,
      actorRole,
    });

    res.status(201).json({
      data: result,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/transfers
productsInventoryRouter.get('/inventory/transfers', async (req, res, next) => {
  try {
    const movements = await stockMovementRepo.find({ type: 'TRANSFER' }, { createdAt: -1 });
    res.json({
      data: movements,
      meta: { total: movements.length },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/transfers
productsInventoryRouter.post('/inventory/transfers', async (req, res, next) => {
  try {
    if (!isPriceManager(req.user?.role)) {
      throw new ApiError(
        403,
        'TRANSFER_FORBIDDEN',
        'Chỉ Quản lý/Admin mới được tạo Phiếu xuất kho chuyển tầng (Kho Tầng 1 ↔ Kho Tầng 2)'
      );
    }

    const { productId, color, size, fromWarehouse, toWarehouse, quantity, note, items } = req.body || {};
    const rawItems: { productId: string; color?: string; size?: string; quantity: number }[] =
      Array.isArray(items) && items.length > 0
        ? items
        : productId !== undefined && quantity !== undefined
        ? [{ productId, color, size, quantity }]
        : [];

    if (rawItems.length === 0 || !fromWarehouse || !toWarehouse) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Vui lòng chọn kho xuất, kho nhận và ít nhất 1 sản phẩm kèm số lượng cần chuyển',
        {
          productId: rawItems.length === 0 ? 'Bắt buộc' : '',
          fromWarehouse: !fromWarehouse ? 'Bắt buộc' : '',
          toWarehouse: !toWarehouse ? 'Bắt buộc' : '',
        }
      );
    }

    const fromFloor = normalizeFloor(fromWarehouse);
    const toFloor = normalizeFloor(toWarehouse);
    if (fromFloor === toFloor) {
      throw new ApiError(
        400,
        'INVALID_WAREHOUSE_TRANSFER',
        'Kho xuất và Kho nhận phải khác nhau (Kho Tầng 1 → Kho Tầng 2 hoặc Kho Tầng 2 → Kho Tầng 1)'
      );
    }

    // Gộp số lượng theo (productId + variantKey)
    const groupedPlans = new Map<
      string,
      { productId: string; color: string; size: string; qty: number }
    >();

    for (const raw of rawItems) {
      const pid = String(raw?.productId || '').trim();
      const c = String(raw?.color || '').trim();
      const s = String(raw?.size || '').trim().toUpperCase();
      const qty = Math.round(Number(raw?.quantity));
      if (!pid || isNaN(qty) || qty <= 0) {
        throw new ApiError(400, 'INVALID_QUANTITY', 'Số lượng chuyển kho của mỗi sản phẩm phải là số nguyên lớn hơn 0');
      }
      const key = `${pid}__${buildVariantKey(c, s)}`;
      const existing = groupedPlans.get(key);
      if (existing) {
        existing.qty += qty;
      } else {
        groupedPlans.set(key, { productId: pid, color: c, size: s, qty });
      }
    }

    // Kiểm tra tồn kho tại kho nguồn trước khi thực hiện
    for (const plan of groupedPlans.values()) {
      const product = await productRepo.findById(plan.productId);
      if (!product) {
        throw new ApiError(404, 'PRODUCT_NOT_FOUND', `Không tìm thấy sản phẩm cần chuyển kho (${plan.productId})`);
      }

      const vStocks = getVariantFloorStocks(product, plan.color, plan.size);
      const sourceAvailable = fromFloor === 'FLOOR_1' ? vStocks.stockFloor1 : vStocks.stockFloor2;
      if (sourceAvailable < plan.qty) {
        const displayName = formatProductWithVariant(product.name, plan.color, plan.size);
        throw new ApiError(
          400,
          'INSUFFICIENT_FLOOR_STOCK',
          `${floorLabel(fromFloor)} chỉ còn ${sourceAvailable} ${product.unit} "${displayName}", không đủ để xuất chuyển ${plan.qty} ${product.unit}`
        );
      }
    }

    const existingTransfers = await stockMovementRepo.find({ type: 'TRANSFER' });
    const distinctCodes = new Set(
      existingTransfers.map((m: any) => m.referenceCode).filter(Boolean)
    );
    const referenceCode = `PXK-${String(distinctCodes.size + 1).padStart(4, '0')}`;

    const createdMovements: any[] = [];
    const updatedProducts: any[] = [];

    for (const plan of groupedPlans.values()) {
      const product = await productRepo.findById(plan.productId);
      if (!product) continue;

      const beforeFloors = getFloorStocks(product);
      const afterSourceDeduct = applyFloorDelta(
        product,
        fromFloor,
        -plan.qty,
        plan.color,
        plan.size
      );
      const afterTargetAdd = applyFloorDelta(
        { ...product, ...afterSourceDeduct },
        toFloor,
        plan.qty,
        plan.color,
        plan.size
      );

      const updatedProduct = await productRepo.updateById(product._id, {
        variants: afterTargetAdd.variants,
        stockFloor1: afterTargetAdd.stockFloor1,
        stockFloor2: afterTargetAdd.stockFloor2,
        stock: afterTargetAdd.stock,
      });
      updatedProducts.push(updatedProduct);

      const displayName = formatProductWithVariant(product.name, plan.color, plan.size);
      const noteText =
        note && String(note).trim()
          ? String(note).trim()
          : `Xuất kho chuyển ${plan.qty} ${product.unit} "${displayName}" từ ${floorLabel(fromFloor)} sang ${floorLabel(toFloor)}`;

      const tfActorId = req.user?.userId || 'ADMIN';
      const tfActorName = req.user?.fullName || 'Quản trị viên';
      const tfActorRole = inferActorRole(req.user?.role, tfActorId, tfActorName);

      const movement = await stockMovementRepo.create({
        type: 'TRANSFER',
        productId: product._id,
        productCode: product.code,
        productName: displayName,
        color: plan.color,
        size: plan.size,
        categoryId: product.categoryId,
        unit: product.unit,
        quantityChange: plan.qty,
        balanceBefore: beforeFloors.stock,
        balanceAfter: afterTargetAdd.stock,
        warehouseLocation: toFloor,
        fromWarehouse: fromFloor,
        toWarehouse: toFloor,
        referenceType: 'TRANSFER',
        referenceId: product._id,
        referenceCode,
        performedBy: tfActorId,
        performedByName: tfActorName,
        performedByRole: tfActorRole,
        note: noteText,
      });
      createdMovements.push(movement);
    }

    res.status(201).json({
      data: {
        referenceCode,
        movements: createdMovements,
        movement: createdMovements[0],
        products: updatedProducts,
        product: updatedProducts[0],
      },
      meta: { totalItems: createdMovements.length },
    });
  } catch (err) {
    next(err);
  }
});
