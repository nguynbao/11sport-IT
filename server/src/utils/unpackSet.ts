import { productRepo, stockMovementRepo } from '../config/db';
import { WarehouseFloor } from '../models/Product';
import { ApiError } from './errors';
import {
  applyFloorDelta,
  floorLabel,
  formatProductWithVariant,
  getFloorStocks,
  getVariantFloorStocks,
  normalizeFloor,
} from './warehouseFloor';

export interface UnpackSetParams {
  retailProductId: string;
  setsToUnpack?: number;
  warehouse?: WarehouseFloor;
  color?: string;
  size?: string;
  reason?: string;
  referenceCode?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
}

export interface UnpackSetResult {
  referenceCode: string;
  setsUnpacked: number;
  packSize: number;
  addedRetailQuantity: number;
  warehouse: WarehouseFloor;
  setProduct: any;
  retailProduct: any;
  setMovement: any;
  retailMovement: any;
}

/**
 * Bổ sung thông tin liên kết Bộ ↔ Lẻ cho danh sách sản phẩm trả về từ API:
 * - Trên Sản phẩm Lẻ: gắn parentSetProductCode, parentSetProductName, parentSetUnit, parentSetStockFloor1, parentSetStockFloor2, maxUnpackableFloor1
 * - Trên Sản phẩm Bộ: gắn mảng linkedRetailProducts[]
 */
export function enrichProductsWithSetLinks(allProducts: any[]): Map<string, any> {
  const prodMap = new Map<string, any>();
  const floorsMap = new Map<string, ReturnType<typeof getFloorStocks>>();
  const retailByParentId = new Map<string, any[]>();

  for (const p of allProducts) {
    const id = String(p._id);
    prodMap.set(id, p);
    const floors = getFloorStocks(p);
    floorsMap.set(id, floors);

    const parentId = String(p.parentSetProductId || '').trim();
    const packSize = Math.max(0, Math.round(Number(p.packSize) || 0));
    if (parentId && packSize > 0 && parentId !== id) {
      const list = retailByParentId.get(parentId) || [];
      list.push({
        _id: id,
        code: p.code,
        name: p.name,
        unit: p.unit || 'Cái',
        packSize,
        sellingPrice: Number(p.sellingPrice || 0),
        stockFloor1: floors.stockFloor1,
        stockFloor2: floors.stockFloor2,
        stock: floors.stock,
      });
      retailByParentId.set(parentId, list);
    }
  }

  const enrichedMap = new Map<string, any>();
  for (const p of allProducts) {
    const id = String(p._id);
    const parentId = String(p.parentSetProductId || '').trim();
    const packSize = Math.max(0, Math.round(Number(p.packSize) || 0));
    const parentProd = parentId && parentId !== id ? prodMap.get(parentId) : undefined;
    const parentFloors = parentProd ? floorsMap.get(String(parentProd._id)) : undefined;
    const linkedRetails = retailByParentId.get(id) || [];

    if (parentProd && parentFloors && packSize > 0) {
      enrichedMap.set(id, {
        parentSetProductId: String(parentProd._id),
        packSize,
        parentSetProductCode: parentProd.code,
        parentSetProductName: parentProd.name,
        parentSetUnit: parentProd.unit || 'Bộ',
        parentSetStockFloor1: parentFloors.stockFloor1,
        parentSetStockFloor2: parentFloors.stockFloor2,
        maxUnpackableFloor1: parentFloors.stockFloor1 * packSize,
        linkedRetailProducts: linkedRetails,
      });
    } else {
      enrichedMap.set(id, {
        parentSetProductId: parentId || '',
        packSize: parentId ? packSize : 0,
        parentSetProductCode: '',
        parentSetProductName: '',
        parentSetUnit: '',
        parentSetStockFloor1: 0,
        parentSetStockFloor2: 0,
        maxUnpackableFloor1: 0,
        linkedRetailProducts: linkedRetails,
      });
    }
  }

  return enrichedMap;
}

/**
 * Thực hiện tách N Bộ/Hộp từ Sản phẩm Bộ gốc sang Sản phẩm Lẻ tại tầng kho chỉ định (mặc định FLOOR_1).
 * Tự động trừ tồn kho Sản phẩm Bộ (-N), cộng tồn kho Sản phẩm Lẻ (+N * packSize) và ghi 2 bút toán Sổ kho.
 */
export async function executeUnpackSetToRetail(params: UnpackSetParams): Promise<UnpackSetResult> {
  const {
    retailProductId,
    setsToUnpack = 1,
    warehouse = 'FLOOR_1',
    color = '',
    size = '',
    reason,
    referenceCode: explicitRefCode,
    actorId = 'ADMIN',
    actorName = 'Hệ thống',
    actorRole = 'ADMIN',
  } = params;

  const numSets = Math.round(Number(setsToUnpack));
  if (isNaN(numSets) || numSets <= 0) {
    throw new ApiError(400, 'INVALID_UNPACK_SETS', 'Số lượng Bộ/Hộp cần tách phải là số nguyên lớn hơn 0');
  }

  const retailProduct =
    (await productRepo.findById(String(retailProductId))) ||
    (await productRepo.findOne({ code: String(retailProductId).toUpperCase() }));

  if (!retailProduct) {
    throw new ApiError(404, 'RETAIL_PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm lẻ cần tách bộ');
  }

  const parentSetId = String(retailProduct.parentSetProductId || '').trim();
  const packSize = Math.max(0, Math.round(Number(retailProduct.packSize) || 0));

  if (!parentSetId || packSize <= 0) {
    throw new ApiError(
      400,
      'PRODUCT_NOT_LINKED_TO_SET',
      `Sản phẩm "${retailProduct.name}" chưa được cấu hình liên kết với Sản phẩm Bộ/Hộp gốc và tỷ lệ quy đổi (packSize > 0)`
    );
  }

  if (parentSetId === String(retailProduct._id)) {
    throw new ApiError(400, 'INVALID_SET_LINK', 'Sản phẩm lẻ không thể tự liên kết làm Sản phẩm Bộ của chính nó');
  }

  const setProduct =
    (await productRepo.findById(parentSetId)) ||
    (await productRepo.findOne({ code: parentSetId.toUpperCase() }));

  if (!setProduct) {
    throw new ApiError(
      404,
      'SET_PRODUCT_NOT_FOUND',
      `Không tìm thấy Sản phẩm Bộ/Hộp gốc (ID: ${parentSetId}) của "${retailProduct.name}"`
    );
  }

  const targetFloor = normalizeFloor(warehouse);
  const cleanColor = String(color || '').trim();
  const cleanSize = String(size || '').trim().toUpperCase();

  const setFloors = getFloorStocks(setProduct);
  // Nếu Sản phẩm Bộ cũng chia biến thể Màu/Size thì kiểm tra biến thể tương ứng; nếu không chia biến thể thì kiểm tra tồn chung
  const setHasVariants = setFloors.variants.length > 0 && (cleanColor || cleanSize);
  const setTargetStocks = setHasVariants
    ? getVariantFloorStocks(setProduct, cleanColor, cleanSize)
    : setFloors;

  const availableAtTargetFloor =
    targetFloor === 'FLOOR_2' ? setTargetStocks.stockFloor2 : setTargetStocks.stockFloor1;
  const availableAtOtherFloor =
    targetFloor === 'FLOOR_2' ? setTargetStocks.stockFloor1 : setTargetStocks.stockFloor2;

  const setDisplayName = formatProductWithVariant(
    setProduct.name,
    setHasVariants ? cleanColor : '',
    setHasVariants ? cleanSize : ''
  );
  const retailDisplayName = formatProductWithVariant(retailProduct.name, cleanColor, cleanSize);

  if (availableAtTargetFloor < numSets) {
    if (targetFloor === 'FLOOR_1' && availableAtOtherFloor >= numSets) {
      throw new ApiError(
        400,
        'INSUFFICIENT_SET_FLOOR1_NEED_TRANSFER',
        `Sản phẩm lẻ "${retailDisplayName}" đã hết tại Kho Tầng 1 và Sản phẩm bộ "${setDisplayName}" (${setProduct.code}) chỉ còn ${availableAtOtherFloor} ${setProduct.unit} ở Kho Tầng 2 (Kho Tầng 1 còn ${availableAtTargetFloor} ${setProduct.unit}). Vui lòng chuyển tầng Sản phẩm bộ xuống Kho Tầng 1 trước!`,
        {
          retailProductId: String(retailProduct._id),
          setProductId: String(setProduct._id),
          setStockFloor1: String(availableAtTargetFloor),
          setStockFloor2: String(availableAtOtherFloor),
        }
      );
    }

    throw new ApiError(
      400,
      'INSUFFICIENT_SET_STOCK',
      `Không đủ tồn kho Sản phẩm bộ "${setDisplayName}" (${setProduct.code}) tại ${floorLabel(targetFloor)} để tách (Cần tách: ${numSets} ${setProduct.unit}, Hiện có tại ${floorLabel(targetFloor)}: ${availableAtTargetFloor} ${setProduct.unit})`,
      {
        retailProductId: String(retailProduct._id),
        setProductId: String(setProduct._id),
        setStockAtFloor: String(availableAtTargetFloor),
      }
    );
  }

  const addedRetailQuantity = numSets * packSize;

  // 1. Trừ tồn kho trên Sản phẩm Bộ
  const setDeltaRes = applyFloorDelta(
    setProduct,
    targetFloor,
    -numSets,
    setHasVariants ? cleanColor : '',
    setHasVariants ? cleanSize : ''
  );
  const updatedSetProduct = await productRepo.updateById(setProduct._id, {
    variants: setDeltaRes.variants,
    stockFloor1: setDeltaRes.stockFloor1,
    stockFloor2: setDeltaRes.stockFloor2,
    stock: setDeltaRes.stock,
  });

  // 2. Cộng tồn kho trên Sản phẩm Lẻ
  const retailDeltaRes = applyFloorDelta(
    retailProduct,
    targetFloor,
    addedRetailQuantity,
    cleanColor,
    cleanSize
  );
  const retailPatch: Record<string, any> = {
    variants: retailDeltaRes.variants,
    stockFloor1: retailDeltaRes.stockFloor1,
    stockFloor2: retailDeltaRes.stockFloor2,
    stock: retailDeltaRes.stock,
  };
  if ((!retailProduct.costPrice || retailProduct.costPrice <= 0) && Number(setProduct.costPrice) > 0) {
    retailPatch.costPrice = Math.round(Number(setProduct.costPrice) / packSize);
  }
  const updatedRetailProduct = await productRepo.updateById(retailProduct._id, retailPatch);

  // 3. Ghi 2 bút toán Sổ kho (StockMovement)
  let referenceCode = explicitRefCode || '';
  if (!referenceCode) {
    const adjCount = await stockMovementRepo.countDocuments({ type: 'ADJUSTMENT' });
    referenceCode = `TB-${String(adjCount + 1).padStart(4, '0')}`;
  }

  const cleanReason = reason && String(reason).trim() ? String(reason).trim() : 'Tách sản phẩm bộ sang lẻ';

  const setMovement = await stockMovementRepo.create({
    type: 'ADJUSTMENT',
    productId: setProduct._id,
    productCode: setProduct.code,
    productName: setDisplayName,
    color: setHasVariants ? cleanColor : '',
    size: setHasVariants ? cleanSize : '',
    categoryId: setProduct.categoryId,
    unit: setProduct.unit,
    quantityChange: -numSets,
    balanceBefore: setDeltaRes.balanceBefore,
    balanceAfter: setDeltaRes.balanceAfter,
    warehouseLocation: targetFloor,
    referenceType: 'ADJUSTMENT',
    referenceId: retailProduct._id,
    referenceCode,
    performedBy: actorId,
    performedByName: actorName,
    performedByRole: actorRole,
    note: `[${floorLabel(targetFloor)}] Tách ${numSets} ${setProduct.unit} sang +${addedRetailQuantity} ${retailProduct.unit} "${retailDisplayName}" (${retailProduct.code}) — ${cleanReason}`,
  });

  const retailMovement = await stockMovementRepo.create({
    type: 'ADJUSTMENT',
    productId: retailProduct._id,
    productCode: retailProduct.code,
    productName: retailDisplayName,
    color: cleanColor,
    size: cleanSize,
    categoryId: retailProduct.categoryId,
    unit: retailProduct.unit,
    quantityChange: addedRetailQuantity,
    balanceBefore: retailDeltaRes.balanceBefore,
    balanceAfter: retailDeltaRes.balanceAfter,
    warehouseLocation: targetFloor,
    referenceType: 'ADJUSTMENT',
    referenceId: setProduct._id,
    referenceCode,
    performedBy: actorId,
    performedByName: actorName,
    performedByRole: actorRole,
    note: `[${floorLabel(targetFloor)}] Nhận +${addedRetailQuantity} ${retailProduct.unit} từ tách ${numSets} ${setProduct.unit} "${setDisplayName}" (${setProduct.code}) — ${cleanReason}`,
  });

  return {
    referenceCode,
    setsUnpacked: numSets,
    packSize,
    addedRetailQuantity,
    warehouse: targetFloor,
    setProduct: updatedSetProduct,
    retailProduct: updatedRetailProduct,
    setMovement,
    retailMovement,
  };
}
