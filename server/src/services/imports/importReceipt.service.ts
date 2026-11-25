import { categoryRepo, importReceiptRepo, productRepo, staffRepo, stockMovementRepo } from "../../repositories";
import { ensureStandardProductCodesMigrated } from "../../config/seed";
import { loadImportSchemeContext } from "../catalog";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { created as createdResult, ok, ServiceResult } from "../../shared/result";
import { filterAndRankBySearch } from "../../shared/search";
import { applyFloorDelta, normalizeFloor } from "../inventory";
import {
  enrichReceiptRoles,
  inferRole,
  keepCheckerFields,
  normalizeImportItems,
} from "./import.rules";
import { withImportLock } from "./importLock.rules";

export async function generateUniqueImportReceiptCode(): Promise<string> {
  const existingReceipts = await importReceiptRepo.find({});
  let maxSeq = 0;
  const usedCodes = new Set<string>();
  for (const r of existingReceipts) {
    const rawCode = String(r.code || '').trim().toUpperCase();
    if (rawCode) usedCodes.add(rawCode);
    const m = /^PN-(\d+)$/.exec(rawCode);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }
  let seq = Math.max(maxSeq, existingReceipts.length) + 1;
  while (true) {
    const candidate = `PN-${String(seq).padStart(4, '0')}`;
    if (!usedCodes.has(candidate)) {
      const dup = await importReceiptRepo.findOne({ code: candidate });
      if (!dup) return candidate;
    }
    seq += 1;
  }
}


export async function buildStaffRoleMap(): Promise<Map<string, string>> {
  const staffs = await staffRepo.find({});
  const map = new Map<string, string>();
  for (const s of staffs) {
    if (s._id && s.role) map.set(String(s._id), String(s.role).toUpperCase());
    if (s.username && s.role) map.set(String(s.username), String(s.role).toUpperCase());
  }
  return map;
}

export async function buildProductPriceMap(): Promise<
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


export async function listImports(query: any): Promise<ServiceResult> {
  await ensureStandardProductCodesMigrated();
    const { status, search } = query || {};
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

    return ok(filtered, { total: filtered.length });
}

export async function getImportById(id: string): Promise<ServiceResult> {
  const receipt =
      (await importReceiptRepo.findById(id)) ||
      (await importReceiptRepo.findOne({ code: id.toUpperCase() }));
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

    return ok(enriched, {
        totalLines,
        checkedLines,
        confirmedLines,
      });
}

export async function createImport(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const { note, defaultCategoryId, items, status, targetWarehouse } = body || {};
    const categories = await categoryRepo.find({ status: 'ACTIVE' });
    const fallbackCatId = defaultCategoryId || categories[0]?._id || '';

    const normalizedItems = normalizeImportItems(
      items || [],
      fallbackCatId,
      categories,
      await loadImportSchemeContext()
    );

    const initialStatus = status === 'CHECKING' ? 'CHECKING' : 'DRAFT';
    const warehouseFloor = normalizeFloor(targetWarehouse);
    const createdBy = ctx.user?.userId || 'ACCOUNTANT';
    const createdByName = ctx.user?.fullName || 'Kế toán kho';
    const createdByRole = inferRole(ctx.user?.role, createdBy, createdByName);

    const itemsWithCreatorCheck = normalizedItems.map((it) => {
      if (it.isChecked && !it.checkedBy && !it.checkedByName) {
        return {
          ...it,
          checkedBy: createdBy,
          checkedByName: createdByName,
          checkedByRole: createdByRole,
          checkedAt: it.checkedAt || new Date(),
        };
      }
      return it;
    });

    const created = await withImportLock('CREATE_IMPORT_RECEIPT', async () => {
      const code = await generateUniqueImportReceiptCode();
      return importReceiptRepo.create({
        code,
        status: initialStatus,
        targetWarehouse: warehouseFloor,
        defaultCategoryId: fallbackCatId,
        note: note ? String(note).trim() : '',
        items: itemsWithCreatorCheck,
        createdBy,
        createdByName,
        createdByRole,
      });
    });

    return createdResult(created, {});
}

export async function updateImport(ctx: ServiceContext, id: string, body: any): Promise<ServiceResult> {
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

    const { note, defaultCategoryId, items, status, targetWarehouse } = body || {};
    const updateData: Record<string, any> = {};

    if (note !== undefined) updateData.note = String(note).trim();
    if (defaultCategoryId !== undefined) updateData.defaultCategoryId = String(defaultCategoryId);
    if (targetWarehouse !== undefined) updateData.targetWarehouse = normalizeFloor(targetWarehouse);
    if (items !== undefined) {
      const categories = await categoryRepo.find({});
      updateData.items = keepCheckerFields(
        normalizeImportItems(
          items,
          defaultCategoryId || receipt.defaultCategoryId,
          categories,
          await loadImportSchemeContext()
        ),
        receipt.items
      );
    }
    if (status && ['DRAFT', 'CHECKING'].includes(status)) {
      updateData.status = status;
    }

    const updated = await importReceiptRepo.updateById(id, updateData);
    return ok(updated, {});
}

export async function finishImportListing(ctx: ServiceContext, id: string, body?: any): Promise<ServiceResult> {
      const receipt = await importReceiptRepo.findById(id);
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }

    if (receipt.status === 'COMPLETED') {
      throw new ApiError(400, 'IMPORT_RECEIPT_LOCKED', 'Phiếu nhập đã hoàn thành');
    }

    const categories = await categoryRepo.find({});
    const itemsToSave = body?.items
      ? keepCheckerFields(
          normalizeImportItems(
            body.items,
            receipt.defaultCategoryId,
            categories,
            await loadImportSchemeContext()
          ),
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

    return ok(updated, {});
}

export async function deleteImport(ctx: ServiceContext, id: string): Promise<ServiceResult> {
      const receipt = await importReceiptRepo.findById(id);
    if (!receipt) {
      throw new ApiError(404, 'IMPORT_RECEIPT_NOT_FOUND', 'Không tìm thấy phiếu nhập kho');
    }

    if (receipt.status === 'COMPLETED') {
      if (!['ADMIN', 'CEO'].includes(ctx.user?.role || '')) {
        throw new ApiError(
          400,
          'IMPORT_RECEIPT_LOCKED',
          'Phiếu nhập đã hoàn thành và bị khóa; chỉ Quản lý/Admin/CEO mới có quyền xóa'
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

    return ok({
        deleted: true,
        _id: receipt._id,
        code: receipt.code,
      }, {});
}

