import { productRepo, stockMovementRepo } from "../../repositories";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { created, ServiceResult } from "../../shared/result";
import { buildVariantKey } from "../../shared/productCode";
import { applyFloorDelta, floorLabel, formatProductWithVariant, getFloorStocks, getVariantFloorStocks, normalizeFloor } from "./warehouseFloor.rules";
import { inferActorRole } from "./inventory.queries";

const isPriceManager = (role?: string) => role === "CEO" || role === "ADMIN" || role === "ACCOUNTANT";

export async function transferStock(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  if (!isPriceManager(ctx.user?.role)) {
      throw new ApiError(
        403,
        'TRANSFER_FORBIDDEN',
        'Chỉ Quản lý/Admin mới được tạo Phiếu xuất kho chuyển tầng (Kho Tầng 1 ↔ Kho Tầng 2)'
      );
    }

    const { productId, color, size, fromWarehouse, toWarehouse, quantity, note, items } = body || {};
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

      const tfActorId = ctx.user?.userId || 'ADMIN';
      const tfActorName = ctx.user?.fullName || 'Quản trị viên';
      const tfActorRole = inferActorRole(ctx.user?.role, tfActorId, tfActorName);

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

    return created({
        referenceCode,
        movements: createdMovements,
        movement: createdMovements[0],
        products: updatedProducts,
        product: updatedProducts[0],
      }, { totalItems: createdMovements.length });
}

