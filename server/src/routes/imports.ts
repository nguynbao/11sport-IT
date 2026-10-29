import { Router } from 'express';
import {
  importReceiptRepo,
  productRepo,
  categoryRepo,
  stockMovementRepo,
} from '../config/db';
import { generateProductCode } from '../utils/productCode';
import { ApiError } from '../utils/errors';
import { IImportReceiptItem } from '../models/ImportReceipt';

export const importsRouter = Router();

function normalizeImportItems(rawItems: any[], defaultCategoryId = ''): IImportReceiptItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter((item) => item && (item.productName || item.productCode))
    .map((item, idx) => {
      const productName = String(item.productName || item.productCode || '').trim();
      const autoCode = generateProductCode(productName);
      const productCode = item.productCode
        ? generateProductCode(String(item.productCode)) || autoCode
        : autoCode;
      const expectedQuantity = Math.max(0, Math.round(Number(item.expectedQuantity ?? item.quantity ?? 0)));
      const actualQuantity =
        item.actualQuantity !== undefined
          ? Math.max(0, Math.round(Number(item.actualQuantity)))
          : expectedQuantity;

      return {
        stt: Number(item.stt) || idx + 1,
        productId: item.productId ? String(item.productId) : '',
        productCode,
        productName,
        categoryId: item.categoryId ? String(item.categoryId) : defaultCategoryId,
        unit: item.unit ? String(item.unit).trim() : 'Cái',
        expectedQuantity,
        actualQuantity,
        note: item.note ? String(item.note).trim() : '',
        isChecked: Boolean(item.isChecked),
        isConfirmed: Boolean(item.isConfirmed),
        discrepancyNote: item.discrepancyNote ? String(item.discrepancyNote).trim() : '',
      };
    });
}

// POST /api/v1/imports/ocr-preview
importsRouter.post('/imports/ocr-preview', async (req, res, next) => {
  try {
    const { imageText, sampleType } = req.body || {};
    const categories = await categoryRepo.find({ status: 'ACTIVE' });
    const defaultCatId = categories[0]?._id || '';

    let extractedItems: IImportReceiptItem[] = [];

    if (imageText && String(imageText).trim()) {
      // Phân tích văn bản OCR theo từng dòng (STT | Tên hàng | ĐVT | Số lượng | Ghi chú)
      const lines = String(imageText)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      extractedItems = lines.map((line, index) => {
        // Hỗ trợ phân tách bằng dấu | hoặc ; hoặc tab
        const parts = line.split(/[|\t;]+/).map((s) => s.trim());
        let productName = line;
        let unit = 'Cái';
        let expectedQuantity = 10;
        let note = '';

        if (parts.length >= 2) {
          // Nếu cột đầu là số thứ tự
          const startIdx = /^\d+$/.test(parts[0]) ? 1 : 0;
          productName = parts[startIdx] || line;
          unit = parts[startIdx + 1] || 'Cái';
          const parsedQty = parseInt(parts[startIdx + 2] || '10', 10);
          expectedQuantity = isNaN(parsedQty) ? 10 : parsedQty;
          note = parts[startIdx + 3] || '';
        }

        const productCode = generateProductCode(productName);
        return {
          stt: index + 1,
          productId: '',
          productCode,
          productName,
          categoryId: defaultCatId,
          unit,
          expectedQuantity,
          actualQuantity: expectedQuantity,
          note,
          isChecked: false,
          isConfirmed: false,
          discrepancyNote: '',
        };
      });
    } else {
      // Dữ liệu mẫu trích xuất từ Camera OCR chứng từ nhập hàng 11Sport
      const sampleRows =
        sampleType === 'footwear'
          ? [
              {
                productName: 'Giày Chạy Bộ 11Sport Pro (Giày Chạy Bộ 11Sport Pro GCB2026 Trắng size 42)',
                unit: 'Đôi',
                expectedQuantity: 12,
                note: 'Hàng chính hãng đợt mới',
              },
              {
                productName: 'Giày Cầu Lông 11Sport Speed (Giày Cầu Lông 11Sport Speed GCL09 Xanh size 41)',
                unit: 'Đôi',
                expectedQuantity: 8,
                note: 'Mẫu mới về kho',
              },
            ]
          : [
              {
                productName: 'Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)',
                unit: 'Cái',
                expectedQuantity: 20,
                note: 'Lô hàng KMAP262510',
              },
              {
                productName: 'Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Xanh size M)',
                unit: 'Cái',
                expectedQuantity: 15,
                note: 'Lô hàng KMAP262510',
              },
              {
                productName: 'Quần Short Tập Luyện 11Sport (Quần Short Tập Luyện 11Sport QSTL02 Đen size XL)',
                unit: 'Cái',
                expectedQuantity: 25,
                note: 'Mẫu mới nhập lần đầu',
              },
            ];

      extractedItems = sampleRows.map((row, idx) => ({
        stt: idx + 1,
        productId: '',
        productCode: generateProductCode(row.productName),
        productName: row.productName,
        categoryId: defaultCatId,
        unit: row.unit,
        expectedQuantity: row.expectedQuantity,
        actualQuantity: row.expectedQuantity,
        note: row.note,
        isChecked: false,
        isConfirmed: false,
        discrepancyNote: '',
      }));
    }

    res.json({
      data: {
        items: extractedItems,
      },
      meta: {
        totalExtracted: extractedItems.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/imports
importsRouter.get('/imports', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const allReceipts = await importReceiptRepo.find({}, { createdAt: -1 });

    const filtered = allReceipts.filter((r) => {
      if (status && r.status !== String(status).toUpperCase()) return false;
      if (search) {
        const q = String(search).toLowerCase();
        const matchCode = r.code.toLowerCase().includes(q);
        const matchNote = (r.note || '').toLowerCase().includes(q);
        const matchItem = r.items.some(
          (i) =>
            i.productCode.toLowerCase().includes(q) ||
            i.productName.toLowerCase().includes(q)
        );
        if (!matchCode && !matchNote && !matchItem) return false;
      }
      return true;
    });

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

    const totalLines = receipt.items.length;
    const checkedLines = receipt.items.filter((i) => i.isChecked).length;
    const confirmedLines = receipt.items.filter((i) => i.isConfirmed).length;

    res.json({
      data: receipt,
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
    const { note, defaultCategoryId, items, status } = req.body || {};
    const categories = await categoryRepo.find({ status: 'ACTIVE' });
    const fallbackCatId = defaultCategoryId || categories[0]?._id || '';

    const normalizedItems = normalizeImportItems(items || [], fallbackCatId);

    const count = await importReceiptRepo.countDocuments({});
    const code = `PN-${String(count + 1).padStart(4, '0')}`;

    const initialStatus = status === 'CHECKING' ? 'CHECKING' : 'DRAFT';

    const created = await importReceiptRepo.create({
      code,
      status: initialStatus,
      defaultCategoryId: fallbackCatId,
      note: note ? String(note).trim() : '',
      items: normalizedItems,
      createdBy: req.user?.userId || 'WAREHOUSE',
      createdByName: req.user?.fullName || 'Thủ kho',
    });

    res.status(201).json({
      data: created,
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/imports/:id (Lưu nháp / cập nhật danh sách hoặc trạng thái kiểm)
importsRouter.put('/imports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const receipt = await importReceiptRepo.findById(id);
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }

    // BR-10: Khóa phiếu nhập đã COMPLETED
    if (receipt.status === 'COMPLETED') {
      throw new ApiError(
        400,
        'IMPORT_RECEIPT_LOCKED',
        'Phiếu nhập đã hoàn thành (COMPLETED), không được phép chỉnh sửa trực tiếp'
      );
    }

    const { note, defaultCategoryId, items, status } = req.body || {};
    const updateData: Record<string, any> = {};

    if (note !== undefined) updateData.note = String(note).trim();
    if (defaultCategoryId !== undefined) updateData.defaultCategoryId = String(defaultCategoryId);
    if (items !== undefined) {
      updateData.items = normalizeImportItems(
        items,
        defaultCategoryId || receipt.defaultCategoryId
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

// POST /api/v1/imports/:id/finish-listing (Bước 3: Chốt danh sách dự kiến -> CHECKING)
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

    const itemsToSave = req.body?.items
      ? normalizeImportItems(req.body.items, receipt.defaultCategoryId)
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

// POST /api/v1/imports/:id/scan-check (Bước 4: Quét camera tag hoặc tìm kiếm đối chiếu)
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

    const { query, actualQuantity, discrepancyNote } = req.body || {};
    if (!query || !String(query).trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng cung cấp mã hoặc tên hàng từ camera/ô tìm kiếm');
    }

    const rawQuery = String(query).trim();
    const generatedCodeFromQuery = generateProductCode(rawQuery);
    const qLower = rawQuery.toLowerCase();

    const items = [...receipt.items];
    const matchedIndex = items.findIndex(
      (item) =>
        item.productCode === generatedCodeFromQuery ||
        item.productCode.toLowerCase() === qLower ||
        item.productName.toLowerCase().includes(qLower) ||
        item.productCode.toLowerCase().includes(qLower)
    );

    if (matchedIndex === -1) {
      res.json({
        data: {
          matched: false,
          warning: `Mã/tên hàng "${rawQuery}" không khớp với dòng nào trong danh sách dự kiến. Bạn có thể thêm dòng mới hoặc ghi chú chênh lệch.`,
          suggestedItem: {
            stt: items.length + 1,
            productCode: generatedCodeFromQuery,
            productName: rawQuery,
            categoryId: receipt.defaultCategoryId,
            unit: 'Cái',
            expectedQuantity: 0,
            actualQuantity: actualQuantity !== undefined ? Number(actualQuantity) : 1,
            note: 'Phát sinh ngoài danh sách dự kiến',
            isChecked: true,
            isConfirmed: false,
            discrepancyNote: 'Hàng ngoài phiếu dự kiến',
          },
          receipt,
        },
        meta: {},
      });
      return;
    }

    const matchedItem = { ...items[matchedIndex] };
    matchedItem.isChecked = true;
    if (actualQuantity !== undefined) {
      matchedItem.actualQuantity = Math.max(0, Math.round(Number(actualQuantity)));
    }
    if (discrepancyNote !== undefined) {
      matchedItem.discrepancyNote = String(discrepancyNote).trim();
    } else if (matchedItem.actualQuantity !== matchedItem.expectedQuantity) {
      const diff = matchedItem.actualQuantity - matchedItem.expectedQuantity;
      matchedItem.discrepancyNote =
        diff > 0 ? `Thừa ${diff} ${matchedItem.unit}` : `Thiếu ${Math.abs(diff)} ${matchedItem.unit}`;
    }

    items[matchedIndex] = matchedItem;
    const updatedReceipt = await importReceiptRepo.updateById(id, {
      status: 'CHECKING',
      items,
    });

    res.json({
      data: {
        matched: true,
        matchedIndex,
        matchedItem,
        discrepancy: matchedItem.actualQuantity - matchedItem.expectedQuantity,
        receipt: updatedReceipt,
      },
      meta: {},
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/imports/:id/complete (Bước 7: Hoàn thành nhập kho)
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

    // Cho phép gửi kèm danh sách items đã tick xác nhận ở bước cuối
    const finalItems = req.body?.items
      ? normalizeImportItems(req.body.items, receipt.defaultCategoryId)
      : receipt.items;

    const confirmedItems = finalItems.filter((i) => i.isConfirmed);
    if (confirmedItems.length === 0) {
      throw new ApiError(
        400,
        'NO_CONFIRMED_ITEMS',
        'Vui lòng tick xác nhận ít nhất 1 dòng hàng đã kiểm trước khi bấm Hoàn thành nhập kho'
      );
    }

    const categories = await categoryRepo.find({});
    const defaultCategory =
      categories.find((c) => String(c._id) === String(receipt.defaultCategoryId)) ||
      categories[0];

    const createdMovements: any[] = [];
    const updatedItems: IImportReceiptItem[] = [];

    for (const item of finalItems) {
      if (!item.isConfirmed) {
        updatedItems.push(item);
        continue;
      }

      const code = item.productCode || generateProductCode(item.productName);
      let product = await productRepo.findOne({ code });

      const itemCat =
        categories.find((c) => String(c._id) === String(item.categoryId)) ||
        defaultCategory;

      // Nếu sản phẩm chưa có trên hệ thống -> Tự động tạo mới với sellingPrice = 0 (BR-04, BR-09)
      if (!product) {
        product = await productRepo.create({
          code,
          name: item.productName,
          categoryId: itemCat ? itemCat._id : '',
          categoryCode: itemCat ? itemCat.code : 'AO',
          categoryName: itemCat ? itemCat.name : 'Áo thể thao',
          unit: item.unit || 'Cái',
          sellingPrice: 0,
          stock: 0,
          status: 'ACTIVE',
        });
      }

      const qtyToAdd = Math.max(0, Math.round(Number(item.actualQuantity)));
      const balanceBefore = product.stock;
      const balanceAfter = balanceBefore + qtyToAdd;

      await productRepo.updateById(product._id, {
        stock: balanceAfter,
      });

      const movement = await stockMovementRepo.create({
        type: 'IMPORT',
        productId: product._id,
        productCode: product.code,
        productName: product.name,
        categoryId: product.categoryId,
        unit: product.unit,
        quantityChange: qtyToAdd,
        balanceBefore,
        balanceAfter,
        referenceType: 'IMPORT_RECEIPT',
        referenceId: receipt._id,
        referenceCode: receipt.code,
        performedBy: req.user?.userId || receipt.createdBy || 'WAREHOUSE',
        performedByName: req.user?.fullName || receipt.createdByName || 'Thủ kho',
        note: item.discrepancyNote || item.note || `Nhập kho theo phiếu ${receipt.code}`,
      });

      createdMovements.push(movement);
      updatedItems.push({
        ...item,
        productId: product._id,
        productCode: product.code,
      });
    }

    const completedReceipt = await importReceiptRepo.updateById(id, {
      status: 'COMPLETED',
      items: updatedItems,
      completedBy: req.user?.userId || 'WAREHOUSE',
      completedByName: req.user?.fullName || 'Thủ kho',
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
