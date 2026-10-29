import { Router } from 'express';
import { categoryRepo, productRepo } from '../config/db';
import { normalizeToUpperCode } from '../utils/productCode';
import { ApiError } from '../utils/errors';

export const categoriesRouter = Router();

// GET /api/v1/categories
categoriesRouter.get('/categories', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter: Record<string, any> = {};
    if (status) {
      filter.status = String(status).toUpperCase();
    }

    const categories = await categoryRepo.find(filter, { createdAt: 1 });
    const allProducts = await productRepo.find({});

    const data = categories.map((cat) => {
      const productCount = allProducts.filter(
        (p) => String(p.categoryId) === String(cat._id)
      ).length;
      return {
        ...cat,
        productCount,
      };
    });

    res.json({
      data,
      meta: { total: data.length },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/categories
categoriesRouter.post('/categories', async (req, res, next) => {
  try {
    const { code, name, status } = req.body || {};
    if (!code || !name) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Mã và tên category là bắt buộc', {
        code: !code ? 'Bắt buộc' : '',
        name: !name ? 'Bắt buộc' : '',
      });
    }

    const normalizedCode = normalizeToUpperCode(String(code));
    if (!normalizedCode) {
      throw new ApiError(400, 'INVALID_CATEGORY_CODE', 'Mã category không hợp lệ');
    }

    const existing = await categoryRepo.findOne({ code: normalizedCode });
    if (existing) {
      throw new ApiError(400, 'DUPLICATE_CATEGORY_CODE', `Mã category "${normalizedCode}" đã tồn tại`, {
        code: 'Mã đã tồn tại',
      });
    }

    const created = await categoryRepo.create({
      code: normalizedCode,
      name: String(name).trim(),
      status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });

    res.status(201).json({
      data: { ...created, productCount: 0 },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/categories/:id
categoriesRouter.patch('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await categoryRepo.findById(id);
    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy category');
    }

    const { name, status } = req.body || {};
    const updateData: Record<string, any> = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Tên category không được để trống');
      }
      updateData.name = String(name).trim();
    }
    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        throw new ApiError(400, 'INVALID_STATUS', 'Trạng thái category phải là ACTIVE hoặc INACTIVE');
      }
      updateData.status = status;
    }

    const updated = await categoryRepo.updateById(id, updateData);

    // Đồng bộ tên category trên sản phẩm nếu đổi tên
    if (updateData.name) {
      const products = await productRepo.find({ categoryId: id });
      for (const p of products) {
        await productRepo.updateById(p._id, { categoryName: updateData.name });
      }
    }

    const productCount = await productRepo.countDocuments({ categoryId: id });

    res.json({
      data: { ...updated, productCount },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/categories/:id
categoriesRouter.delete('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await categoryRepo.findById(id);
    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy category');
    }

    const productCount = await productRepo.countDocuments({ categoryId: id });
    if (productCount > 0) {
      throw new ApiError(
        400,
        'CATEGORY_HAS_PRODUCTS',
        'Không thể xóa category đang có sản phẩm; chỉ được ngừng sử dụng',
        { categoryId: `Đang có ${productCount} sản phẩm` }
      );
    }

    await categoryRepo.deleteById(id);
    res.json({
      data: { deleted: true, _id: id },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});
