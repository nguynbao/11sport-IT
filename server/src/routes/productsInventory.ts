import { Router } from 'express';
import { categoryRepo, productRepo, stockMovementRepo, staffRepo } from '../config/db';
import { ensureStandardProductCodesMigrated } from '../config/seed';
import {
  generateProductCode,
  generateVariantProductCode,
  extractVariantFromText,
  buildVariantKey,
  isStandardSixDigitProductCode,
} from '../utils/productCode';
import { ApiError } from '../utils/errors';
import {
  normalizeFloor,
  floorLabel,
  getFloorStocks,
  getVariantFloorStocks,
  applyFloorDelta,
  summarizeVariants,
  formatProductWithVariant,
} from '../utils/warehouseFloor';
import { filterAndRankBySearch } from '../utils/search';

export const productsInventoryRouter = Router();

// Quản lý/Admin (role ADMIN) quản lý toàn bộ giá & tồn; Thủ kho (role WAREHOUSE) cũng được phép nhập/cập nhật giá bán
const isPriceManager = (role?: string) => role === 'ADMIN';
const canEditSellingPrice = (role?: string) => role === 'ADMIN' || role === 'WAREHOUSE';

function inferActorRole(
  explicitRole?: string,
  userId?: string,
  userName?: string,
  staffRoleMap?: Map<string, string>,
  fallback = 'ADMIN'
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
  if (upperId === 'SALES') return 'SALES';
  const nameLower = String(userName || '').toLowerCase();
  if (nameLower.includes('admin') || nameLower.includes('quản trị') || nameLower.includes('quản lý')) {
    return 'ADMIN';
  }
  if (nameLower.includes('thủ kho') || nameLower.includes('kho')) {
    return 'WAREHOUSE';
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
    const baseFiltered = allProducts
      .map((p) => {
        const cat =
          catMap.get(String(p.categoryId)) ||
          (p.categoryCode ? catByCode.get(String(p.categoryCode).toUpperCase()) : undefined) ||
          (p.categoryName ? catByName.get(String(p.categoryName).trim().toLowerCase()) : undefined);
        const { costPrice, ...rest } = p as any;
        const floors = getFloorStocks(p);
        const visibleVariants = floors.variants.map((v) => {
          const hasAttr = Boolean(
            (v.color && String(v.color).trim()) || (v.size && String(v.size).trim())
          );
          const vCode = hasAttr
            ? generateVariantProductCode(p.code, v.color, v.size)
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
          brand: p.brand || '',
          modelName: p.modelName || '',
          variants: visibleVariants,
          categoryId: cat?._id ? String(cat._id) : p.categoryId,
          stockFloor1: floors.stockFloor1,
          stockFloor2: isSalesRole ? 0 : floors.stockFloor2,
          stock: isSalesRole ? floors.stockFloor1 : floors.stock,
          ...(hideCost ? {} : { costPrice: Number(costPrice) || 0 }),
          categoryCode: cat?.code || p.categoryCode || '',
          categoryName: cat?.name || p.categoryName || '',
        };
      })
      .filter((p) => {
        if (isSalesRole && (Number(p.stockFloor1) || 0) <= 0) return false;
        if (categoryId && String(p.categoryId) !== String(categoryId)) return false;
        if (onlySellable === 'true') {
          if (!(p.sellingPrice > 0 && p.stockFloor1 > 0)) return false;
        }
        return true;
      });

    const filtered = search
      ? filterAndRankBySearch(baseFiltered, String(search), (p) => [
          { text: p.code, weight: 1.5 },
          { text: (p as any).barcode, weight: 1.5 },
          { text: p.name, weight: 1.3 },
          { text: p.brand, weight: 1.1 },
          { text: p.categoryName, weight: 0.9 },
          { text: p.categoryCode, weight: 0.9 },
          { text: p.unit, weight: 0.6 },
          ...(Array.isArray(p.variants)
            ? p.variants.flatMap((v: any) => [
                { text: v.variantCode, weight: 1.6 },
                { text: v.barcode, weight: 1.5 },
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
      size,
      variants: rawInputVariants,
      categoryId,
      unit,
      sellingPrice,
      costPrice,
      quantity,
      targetWarehouse,
      upsertIfExists,
    } = req.body || {};
    const targetFloor = normalizeFloor(targetWarehouse);
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
    let code =
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

    let existing = await productRepo.findOne({ code });
    if (
      existing &&
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

    const hasVariantPayload = Boolean(finalColor || finalSize || inputVariantsList);

    if (existing) {
      if ((upsertIfExists || hasVariantPayload) && isPriceManager(req.user?.role)) {
        let workingProd: any = { ...existing };
        const beforeStock = getFloorStocks(existing).stock;

        if (inputVariantsList) {
          const mergedVariants = [...getFloorStocks(existing).variants, ...inputVariantsList];
          const sum = summarizeVariants(mergedVariants, existing.code);
          workingProd = {
            ...workingProd,
            variants: sum.variants,
            stockFloor1: sum.stockFloor1,
            stockFloor2: sum.stockFloor2,
            stock: sum.stock,
          };
        } else {
          const floorResult = applyFloorDelta(existing, targetFloor, qty, finalColor, finalSize);
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
        400,
        'DUPLICATE_PRODUCT_CODE',
        `Mã sản phẩm "${code}" đã tồn tại trên hệ thống`,
        { code: 'Đã tồn tại' }
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
    } = req.body || {};

    // BR-03: Mã sản phẩm không được sửa sau khi tạo
    if (code !== undefined && String(code).toUpperCase() !== product.code) {
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
        const sum = summarizeVariants(rawVariants, product.code);
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
    if (brand !== undefined) {
      updateData.brand = String(brand).trim();
    }
    if (modelName !== undefined) {
      updateData.modelName = String(modelName).trim();
    }
    if (categoryId !== undefined) {
      const cat = await categoryRepo.findById(String(categoryId));
      if (!cat) {
        throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'Danh mục không tồn tại');
      }
      updateData.categoryId = cat._id;
      updateData.categoryCode = cat.code;
      updateData.categoryName = cat.name;

      // Đồng bộ chữ cái đầu tiên của Category trong Mã sản phẩm khi đổi danh mục
      const nextCode = generateProductCode(updateData.name || product.name, {
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

    const updated = await productRepo.updateById(id, updateData);

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
            ? 'WAREHOUSE'
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
