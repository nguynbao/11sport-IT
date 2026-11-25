import { productRepo, stockMovementRepo } from "../../repositories";
import { ApiError } from "../../shared/errors";
import { ServiceContext } from "../../shared/http";
import { created, ok, ServiceResult } from "../../shared/result";
import { applyFloorDelta, floorLabel, formatProductWithVariant, getFloorStocks, getVariantFloorStocks, normalizeFloor } from "./warehouseFloor.rules";
import { inferActorRole } from "./inventory.queries";
import { executeUnpackSetToRetail } from "./unpackSet.service";

const isPriceManager = (role?: string) => role === "CEO" || role === "ADMIN" || role === "ACCOUNTANT";

export async function adjustStock(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const { productId, quantityChange, reason, warehouse, color, size } = body || {};
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
    const adjActorId = ctx.user?.userId || 'ADMIN';
    const adjActorName = ctx.user?.fullName || 'Quản lý kho';
    const adjActorRole = inferActorRole(ctx.user?.role, adjActorId, adjActorName);

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

    return created({
        movement,
        product: updatedProduct,
      }, {});
}

export async function unpackSet(ctx: ServiceContext, body: any): Promise<ServiceResult> {
  const { retailProductId, setsToUnpack = 1, warehouse = 'FLOOR_1', color, size, reason } = body || {};
    if (!retailProductId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng chọn sản phẩm lẻ cần tách bộ', {
        retailProductId: 'Bắt buộc',
      });
    }

    const actorId = ctx.user?.userId || 'ADMIN';
    const actorName = ctx.user?.fullName || 'Quản lý kho';
    const actorRole = inferActorRole(ctx.user?.role, actorId, actorName);

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

    return created(result, {});
}

