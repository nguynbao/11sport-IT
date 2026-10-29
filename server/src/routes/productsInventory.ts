import { Router } from 'express';
import { categoryRepo, productRepo, stockMovementRepo } from '../config/db';
import { generateProductCode } from '../utils/productCode';
import { ApiError } from '../utils/errors';

export const productsInventoryRouter = Router();

// Chỉ Quản lý/Admin (role ADMIN) được đặt giá bán và sửa giá gốc
const isPriceManager = (role?: string) => role === 'ADMIN';

// POST /api/v1/products/generate-code
productsInventoryRouter.post('/products/generate-code', async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tên sản phẩm là bắt buộc để sinh mã', {
        name: 'Bắt buộc',
      });
    }

    const code = generateProductCode(String(name));
    res.json({
      data: { code },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products
productsInventoryRouter.get('/products', async (req, res, next) => {
  try {
    const { categoryId, search, onlySellable } = req.query;
    const allProducts = await productRepo.find({}, { createdAt: -1 });
    const categories = await categoryRepo.find({});
    const catMap = new Map(categories.map((c) => [String(c._id), c]));

    // Ẩn giá gốc với nhân viên bán hàng
    const hideCost = req.user?.role === 'SALES';
    const filtered = allProducts
      .map((p) => {
        const cat = catMap.get(String(p.categoryId));
        const { costPrice, ...rest } = p as any;
        return {
          ...rest,
          ...(hideCost ? {} : { costPrice: Number(costPrice) || 0 }),
          categoryCode: cat?.code || p.categoryCode || '',
          categoryName: cat?.name || p.categoryName || '',
        };
      })
      .filter((p) => {
        if (categoryId && String(p.categoryId) !== String(categoryId)) return false;
        if (onlySellable === 'true') {
          if (!(p.sellingPrice > 0 && p.stock > 0)) return false;
        }
        if (search) {
          const q = String(search).trim().toLowerCase();
          const matchCode = p.code.toLowerCase().includes(q);
          const matchName = p.name.toLowerCase().includes(q);
          if (!matchCode && !matchName) return false;
        }
        return true;
      });

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
    const { name, categoryId, unit, sellingPrice, costPrice, quantity, upsertIfExists } = req.body || {};
    if (!name || !String(name).trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Tên sản phẩm là bắt buộc', {
        name: 'Bắt buộc',
      });
    }

    const code = generateProductCode(String(name));
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

    const qty = quantity !== undefined ? Math.round(Number(quantity)) : 0;
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

    const existing = await productRepo.findOne({ code });
    if (existing) {
      if (upsertIfExists && isPriceManager(req.user?.role) && qty > 0) {
        const balanceBefore = Number(existing.stock) || 0;
        const balanceAfter = balanceBefore + qty;
        const patchFields: Record<string, any> = {
          stock: balanceAfter,
        };
        if (cost > 0) patchFields.costPrice = cost;
        if (price > 0) patchFields.sellingPrice = price;

        const updated = await productRepo.updateById(existing._id, patchFields);
        await stockMovementRepo.create({
          type: 'IMPORT',
          productId: existing._id,
          productCode: existing.code,
          productName: existing.name,
          categoryId: existing.categoryId,
          unit: existing.unit,
          quantityChange: qty,
          balanceBefore,
          balanceAfter,
          referenceType: 'IMPORT_RECEIPT',
          referenceId: existing._id,
          referenceCode: 'CMS-NHAP-THANG',
          performedBy: req.user?.userId || 'ADMIN',
          performedByName: req.user?.fullName || 'Quản lý kho (CMS)',
          note: `Admin nhập thêm ${qty} ${existing.unit} thẳng vào kho trên CMS`,
        });

        return res.status(200).json({
          data: updated,
          meta: { upserted: true, addedQuantity: qty },
        });
      }

      throw new ApiError(
        400,
        'DUPLICATE_PRODUCT_CODE',
        `Mã sản phẩm "${code}" đã tồn tại trên hệ thống`,
        { code: 'Đã tồn tại' }
      );
    }

    let category = categoryId ? await categoryRepo.findById(String(categoryId)) : null;
    if (!category) {
      // Fallback sang category đầu tiên nếu không truyền hoặc tìm theo code
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

    const created = await productRepo.create({
      code,
      name: String(name).trim(),
      categoryId: category._id,
      categoryCode: category.code,
      categoryName: category.name,
      unit: unit ? String(unit).trim() : 'Cái',
      sellingPrice: price,
      costPrice: cost,
      stock: qty,
      status: 'ACTIVE',
    });

    if (qty > 0) {
      await stockMovementRepo.create({
        type: 'IMPORT',
        productId: created._id,
        productCode: created.code,
        productName: created.name,
        categoryId: created.categoryId,
        unit: created.unit,
        quantityChange: qty,
        balanceBefore: 0,
        balanceAfter: qty,
        referenceType: 'IMPORT_RECEIPT',
        referenceId: created._id,
        referenceCode: 'CMS-NHAP-THANG',
        performedBy: req.user?.userId || 'ADMIN',
        performedByName: req.user?.fullName || 'Quản lý kho (CMS)',
        note: `Admin nhập thẳng sản phẩm mới vào kho trên CMS (${qty} ${created.unit})`,
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

    const { code, stock, allowDirectStock, name, categoryId, unit, sellingPrice, costPrice, status } =
      req.body || {};

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
    const balanceBefore = Number(product.stock) || 0;

    // BR-05: Chỉ cho phép Admin sửa trực tiếp tồn kho từ CMS khi truyền allowDirectStock = true
    if (stock !== undefined && Number(stock) !== balanceBefore) {
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
      const newStock = Math.round(Number(stock));
      if (isNaN(newStock) || newStock < 0) {
        throw new ApiError(400, 'INVALID_QUANTITY', 'Số lượng tồn kho phải là số nguyên không âm');
      }
      stockDelta = newStock - balanceBefore;
      updateData.stock = newStock;
    }

    if (name !== undefined && String(name).trim()) {
      updateData.name = String(name).trim();
    }
    if (categoryId !== undefined) {
      const cat = await categoryRepo.findById(String(categoryId));
      if (!cat) {
        throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'Danh mục không tồn tại');
      }
      updateData.categoryId = cat._id;
      updateData.categoryCode = cat.code;
      updateData.categoryName = cat.name;
    }
    if (unit !== undefined && String(unit).trim()) {
      updateData.unit = String(unit).trim();
    }
    if (sellingPrice !== undefined) {
      const price = Math.round(Number(sellingPrice));
      if (isNaN(price) || price < 0) {
        throw new ApiError(400, 'INVALID_PRICE', 'Giá bán phải là số nguyên không âm');
      }
      if (price !== product.sellingPrice && !isPriceManager(req.user?.role)) {
        throw new ApiError(403, 'SELLING_PRICE_FORBIDDEN', 'Chỉ Quản lý/Admin mới được cập nhật giá bán');
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
          productName: updated.name,
          unit: updated.unit,
          categoryId: updated.categoryId,
        });
      }
    }

    if (stockDelta !== 0 && updated) {
      const isImport = stockDelta > 0;
      await stockMovementRepo.create({
        type: isImport ? 'IMPORT' : 'ADJUSTMENT',
        productId: updated._id,
        productCode: updated.code,
        productName: updated.name,
        categoryId: updated.categoryId,
        unit: updated.unit,
        quantityChange: stockDelta,
        balanceBefore,
        balanceAfter: updated.stock,
        referenceType: isImport ? 'IMPORT_RECEIPT' : 'ADJUSTMENT',
        referenceId: updated._id,
        referenceCode: isImport ? 'CMS-NHAP-THANG' : 'CMS-DIEU-CHINH',
        performedBy: req.user?.userId || 'ADMIN',
        performedByName: req.user?.fullName || 'Quản lý kho (CMS)',
        note: isImport
          ? `Admin nhập thêm ${stockDelta} ${updated.unit} trực tiếp trên CMS`
          : `Admin điều chỉnh giảm ${Math.abs(stockDelta)} ${updated.unit} trực tiếp trên CMS`,
      });
    }

    res.json({
      data: updated,
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

    // Xóa các bút toán sổ kho của sản phẩm này để Báo cáo tồn kho luôn đồng nhất
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
    const [movements, allProducts] = await Promise.all([
      stockMovementRepo.find({}, { createdAt: -1 }),
      productRepo.find({}),
    ]);

    const hideCost = req.user?.role === 'SALES';
    const prodById = new Map(allProducts.map((p) => [String(p._id), p]));
    const prodByCode = new Map(allProducts.map((p) => [String(p.code), p]));

    const fromDate = from ? new Date(String(from)) : null;
    if (fromDate) fromDate.setHours(0, 0, 0, 0);

    const toDate = to ? new Date(String(to)) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const filtered = movements
      .filter((m) => {
        if (productId && String(m.productId) !== String(productId)) return false;
        if (type && m.type !== String(type).toUpperCase()) return false;
        const mTime = new Date(m.createdAt).getTime();
        if (fromDate && mTime < fromDate.getTime()) return false;
        if (toDate && mTime > toDate.getTime()) return false;
        if (search) {
          const q = String(search).toLowerCase();
          const match =
            m.productCode.toLowerCase().includes(q) ||
            m.productName.toLowerCase().includes(q) ||
            m.referenceCode.toLowerCase().includes(q) ||
            (m.note || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .map((m) => {
        const prod = prodById.get(String(m.productId)) || prodByCode.get(String(m.productCode));
        return {
          ...(m as any),
          sellingPrice: Number(prod?.sellingPrice || 0),
          currentStock: Number(prod?.stock ?? m.balanceAfter ?? 0),
          ...(hideCost ? {} : { costPrice: Number(prod?.costPrice || 0) }),
        };
      });

    res.json({
      data: filtered,
      meta: { total: filtered.length },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/report
// Công thức BR-06: closingStock = openingStock + importedQty - soldQty + adjustedAndReturnedQty
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

    const reportRows = allProducts
      .filter((p) => {
        if (categoryId && String(p.categoryId) !== String(categoryId)) return false;
        if (search) {
          const q = String(search).toLowerCase();
          if (!p.code.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) {
            return false;
          }
        }
        return true;
      })
      .map((product) => {
        const pMovements = allMovements.filter(
          (m) => String(m.productId) === String(product._id)
        );

        let openingStock = 0;
        let importedQty = 0;
        let soldQty = 0;
        let adjustedAndReturnedQty = 0;

        for (const m of pMovements) {
          const mTime = new Date(m.createdAt).getTime();
          if (mTime < fromDate.getTime()) {
            openingStock += m.quantityChange;
          } else if (mTime <= toDate.getTime()) {
            if (m.type === 'IMPORT') {
              importedQty += m.quantityChange;
            } else if (m.type === 'SALE') {
              soldQty += Math.abs(m.quantityChange);
            } else {
              // RETURN, EXCHANGE_IN, EXCHANGE_OUT, ADJUSTMENT
              adjustedAndReturnedQty += m.quantityChange;
            }
          }
        }

        const closingStock =
          openingStock + importedQty - soldQty + adjustedAndReturnedQty;

        return {
          productId: product._id,
          productCode: product.code,
          productName: product.name,
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
          currentStock: product.stock,
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
    const { productId, quantityChange, reason } = req.body || {};
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

    const balanceBefore = product.stock;
    const balanceAfter = balanceBefore + delta;
    if (balanceAfter < 0) {
      throw new ApiError(
        400,
        'INSUFFICIENT_STOCK_FOR_ADJUSTMENT',
        `Tồn kho sau điều chỉnh không được âm (Tồn hiện tại: ${balanceBefore}, điều chỉnh: ${delta})`
      );
    }

    await productRepo.updateById(product._id, { stock: balanceAfter });

    const adjCount = await stockMovementRepo.countDocuments({ type: 'ADJUSTMENT' });
    const referenceCode = `DC-${String(adjCount + 1).padStart(4, '0')}`;

    const movement = await stockMovementRepo.create({
      type: 'ADJUSTMENT',
      productId: product._id,
      productCode: product.code,
      productName: product.name,
      categoryId: product.categoryId,
      unit: product.unit,
      quantityChange: delta,
      balanceBefore,
      balanceAfter,
      referenceType: 'ADJUSTMENT',
      referenceId: product._id,
      referenceCode,
      performedBy: req.user?.userId || 'ADMIN',
      performedByName: req.user?.fullName || 'Quản lý kho',
      note: String(reason).trim(),
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
