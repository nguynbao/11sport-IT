import { Router } from 'express';
import {
  importReceiptRepo,
  productRepo,
  categoryRepo,
  stockMovementRepo,
} from '../config/db';
import { generateProductCode } from '../utils/productCode';
import { matchTagToItems } from '../utils/tagMatch';
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
        scannedQuantity: Math.max(0, Math.round(Number(item.scannedQuantity) || 0)),
        note: item.note ? String(item.note).trim() : '',
        isChecked: Boolean(item.isChecked),
        isConfirmed: Boolean(item.isConfirmed),
        discrepancyNote: item.discrepancyNote ? String(item.discrepancyNote).trim() : '',
      };
    });
}

/**
 * Giữ các trường do server ghi (người quét kiểm) khi client gửi lại danh sách items.
 * Không tin dữ liệu người kiểm từ client: luôn lấy từ bản ghi hiện có (khớp theo vị trí + mã hàng).
 */
function keepCheckerFields(newItems: IImportReceiptItem[], oldItems: IImportReceiptItem[]): IImportReceiptItem[] {
  const used = new Set<number>();
  return newItems.map((item, idx) => {
    let oi = oldItems[idx] && oldItems[idx].productCode === item.productCode && !used.has(idx) ? idx : -1;
    if (oi < 0) oi = oldItems.findIndex((o, j) => !used.has(j) && o.productCode === item.productCode);
    if (oi < 0) return { ...item, checkedBy: '', checkedByName: '', checkedAt: undefined, scanCounts: [] };
    used.add(oi);
    const old = oldItems[oi];
    return {
      ...item,
      checkedBy: old.checkedBy || '',
      checkedByName: old.checkedByName || '',
      checkedAt: old.checkedAt,
      scanCounts: Array.isArray(old.scanCounts) ? old.scanCounts.map((s) => ({ ...s })) : [],
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
    scannedQuantity: 0,
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
      updateData.items = keepCheckerFields(
        normalizeImportItems(items, defaultCategoryId || receipt.defaultCategoryId),
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
      ? keepCheckerFields(normalizeImportItems(req.body.items, receipt.defaultCategoryId), receipt.items)
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

// POST /api/v1/imports/:id/scan-check (Bước 4: Chụp tag kiểm thực tế — ĐẾM TỪNG CHIẾC)
// Mỗi lần quét khớp = +1 chiếc; đủ số lượng dự kiến mới tick xác nhận. Không thêm dòng mới.
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

    const { query, productCode, productName, rawText, rowIndex } = req.body || {};
    const delta = Number(req.body?.delta) === -1 ? -1 : 1;
    const hasRowIndex = rowIndex !== undefined && rowIndex !== null && rowIndex !== '';
    const label = String(productName || query || productCode || '').trim();
    if (!hasRowIndex && !label) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng cung cấp mã hoặc tên hàng đọc được từ tag');
    }
    if (delta === -1 && !hasRowIndex) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Hoàn tác lần quét cần chỉ rõ dòng hàng (rowIndex)');
    }

    const items = receipt.items.map((it) => ({
      ...it,
      scannedQuantity: Math.max(0, Number(it.scannedQuantity) || 0),
    }));
    const isFull = (it: IImportReceiptItem) =>
      (Number(it.scannedQuantity) || 0) >= Math.max(1, Number(it.expectedQuantity) || 0);
    const progressOf = (list: IImportReceiptItem[]) => ({
      checked: list.filter(isFull).length,
      total: list.length,
      scannedUnits: list.reduce((s, i) => s + (Number(i.scannedQuantity) || 0), 0),
      expectedUnits: list.reduce((s, i) => s + (Number(i.expectedQuantity) || 0), 0),
    });

    let matchedIndex: number | null = null;
    if (hasRowIndex) {
      const idx = Number(rowIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) {
        throw new ApiError(400, 'INVALID_ROW_INDEX', 'Dòng hàng được chọn không hợp lệ');
      }
      matchedIndex = idx;
    } else {
      // isChecked dùng để ưu tiên dòng CHƯA ĐỦ số lượng khi trùng nhiều dòng
      const result = matchTagToItems(
        items.map((it) => ({ productCode: it.productCode, productName: it.productName, isChecked: isFull(it) })),
        { query, productCode, productName, rawText }
      );
      if (result.ambiguous) {
        res.json({
          data: {
            matched: false,
            ambiguous: true,
            candidates: result.candidates.map((i) => ({
              index: i,
              productCode: items[i].productCode,
              productName: items[i].productName,
              scannedQuantity: items[i].scannedQuantity,
              expectedQuantity: items[i].expectedQuantity,
            })),
            warning: `Tag "${label}" khớp nhiều dòng trong danh sách. Vui lòng chọn đúng dòng.`,
            progress: progressOf(items),
            receipt,
          },
          meta: {},
        });
        return;
      }
      matchedIndex = result.index;
    }

    if (matchedIndex === null) {
      res.json({
        data: {
          matched: false,
          warning: `Tag "${label}" KHÔNG có trong danh sách kiểm hàng. Hàng này không được tự thêm vào phiếu.`,
          progress: progressOf(items),
          receipt,
        },
        meta: {},
      });
      return;
    }

    const current = items[matchedIndex];
    const expected = Number(current.expectedQuantity) || 0;

    // Đã đủ số lượng mà quét thêm => không cộng, chỉ cảnh báo
    if (delta === 1 && isFull(current)) {
      res.json({
        data: {
          matched: true,
          alreadyFull: true,
          isFull: true,
          matchedIndex,
          matchedItem: current,
          scannedQuantity: current.scannedQuantity,
          expectedQuantity: expected,
          warning: `"${current.productName}" đã đủ số lượng (${current.scannedQuantity}/${expected}). Chiếc này có thể là hàng THỪA.`,
          progress: progressOf(items),
          receipt,
        },
        meta: {},
      });
      return;
    }

    const scanned = Math.max(0, current.scannedQuantity + delta);
    const full = scanned >= Math.max(1, expected);

    // Ghi nhận nhân viên quét kiểm (theo user đăng nhập)
    const userId = String(req.user?.userId || '');
    const userName = req.user?.fullName || 'Không xác định';
    const scanCounts = (Array.isArray(current.scanCounts) ? current.scanCounts : []).map((s) => ({ ...s }));
    if (scanned !== current.scannedQuantity) {
      if (delta === 1) {
        const mine = scanCounts.find((s) => s.userId === userId);
        if (mine) {
          mine.quantity += 1;
          mine.name = userName;
        } else {
          scanCounts.push({ userId, name: userName, quantity: 1 });
        }
      } else {
        // Hoàn tác: trừ của chính người thao tác, nếu không có thì trừ người quét gần nhất
        const target =
          scanCounts.find((s) => s.userId === userId && s.quantity > 0) ||
          [...scanCounts].reverse().find((s) => s.quantity > 0);
        if (target) target.quantity -= 1;
      }
    }

    const matchedItem: IImportReceiptItem = {
      ...current,
      scanCounts: scanCounts.filter((s) => s.quantity > 0),
      ...(delta === 1
        ? { checkedBy: userId, checkedByName: userName, checkedAt: new Date() }
        : {}),
      scannedQuantity: scanned,
      actualQuantity: scanned,
      isChecked: scanned > 0,
      isConfirmed: full,
      discrepancyNote:
        scanned === 0 ? '' : full ? (scanned === expected ? 'Khớp đủ' : `Thừa ${scanned - expected} ${current.unit}`) : `Đã quét ${scanned}/${expected} ${current.unit}`,
    };
    items[matchedIndex] = matchedItem;
    const updatedReceipt = await importReceiptRepo.updateById(id, { items });

    res.json({
      data: {
        matched: true,
        alreadyFull: false,
        isFull: full,
        undone: delta === -1,
        matchedIndex,
        matchedItem,
        scannedQuantity: scanned,
        expectedQuantity: expected,
        progress: progressOf(items),
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
      ? keepCheckerFields(normalizeImportItems(req.body.items, receipt.defaultCategoryId), receipt.items)
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
