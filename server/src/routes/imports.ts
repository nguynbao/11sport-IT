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
import {
  OcrTableRow,
  parseTextToRows,
  validateOcrInput,
  ocrScanTable,
  ocrScanTag,
} from '../utils/ocr';

export const importsRouter = Router();

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
        costPrice: parseCostPrice(item.costPrice, Number(item.stt) || idx + 1),
        note: item.note ? String(item.note).trim() : '',
        isChecked: Boolean(item.isChecked),
        isConfirmed: Boolean(item.isConfirmed),
        discrepancyNote: item.discrepancyNote ? String(item.discrepancyNote).trim() : '',
      };
    });
}

function rowsToImportItems(rows: OcrTableRow[], defaultCatId: string): IImportReceiptItem[] {
  return rows.map((r, index) => ({
    stt: index + 1,
    productId: '',
    productCode: generateProductCode(r.productName),
    productName: r.productName,
    categoryId: defaultCatId,
    unit: r.unit || 'Cái',
    expectedQuantity: r.expectedQuantity,
    actualQuantity: r.expectedQuantity,
    costPrice: 0,
    note: r.note || '',
    isChecked: false,
    isConfirmed: false,
    discrepancyNote: '',
  }));
}

// POST /api/v1/imports/ocr-preview — tách văn bản dán tay thành 6 cột
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

// POST /api/v1/imports/ocr-scan — quét ảnh camera / file tải lên (ảnh hoặc PDF)
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
            costPrice: 0,
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
      // Giá bán do Quản lý/Admin cập nhật trên CMS; giá gốc lấy theo dòng nhập
      const itemCostPrice = Math.max(0, Math.round(Number(item.costPrice) || 0));
      if (!product) {
        product = await productRepo.create({
          code,
          name: item.productName,
          categoryId: itemCat ? itemCat._id : '',
          categoryCode: itemCat ? itemCat.code : 'AO',
          categoryName: itemCat ? itemCat.name : 'Áo thể thao',
          unit: item.unit || 'Cái',
          sellingPrice: 0,
          costPrice: itemCostPrice,
          stock: 0,
          status: 'ACTIVE',
        });
      }

      const qtyToAdd = Math.max(0, Math.round(Number(item.actualQuantity)));
      const balanceBefore = product.stock;
      const balanceAfter = balanceBefore + qtyToAdd;

      const productUpdate: Record<string, any> = { stock: balanceAfter };
      // Cập nhật giá gốc theo lần nhập gần nhất (bỏ qua nếu dòng không nhập giá)
      if (itemCostPrice > 0) productUpdate.costPrice = itemCostPrice;
      await productRepo.updateById(product._id, productUpdate);

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
