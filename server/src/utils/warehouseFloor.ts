import { WarehouseFloor } from '../models/Product';

export function normalizeFloor(val?: any): WarehouseFloor {
  return String(val || '').toUpperCase() === 'FLOOR_2' ? 'FLOOR_2' : 'FLOOR_1';
}

export function floorLabel(floor?: any): string {
  return normalizeFloor(floor) === 'FLOOR_2' ? 'Kho Tầng 2' : 'Kho Tầng 1';
}

/**
 * Chuẩn hóa tồn kho theo 2 tầng từ bản ghi Product.
 * Với dữ liệu cũ chưa có stockFloor1/stockFloor2 mà có stock > 0 -> mặc định toàn bộ nằm ở Kho Tầng 1.
 */
export function getFloorStocks(product: any): {
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
} {
  const total = Math.max(0, Number(product?.stock) || 0);
  const hasF1 = product?.stockFloor1 !== undefined && product?.stockFloor1 !== null;
  const hasF2 = product?.stockFloor2 !== undefined && product?.stockFloor2 !== null;

  let f1 = Math.max(0, Number(product?.stockFloor1) || 0);
  let f2 = Math.max(0, Number(product?.stockFloor2) || 0);

  if ((!hasF1 && !hasF2) || (f1 === 0 && f2 === 0 && total > 0)) {
    f1 = total;
    f2 = 0;
  } else if (f1 + f2 !== total) {
    // Đồng bộ chênh lệch về Kho Tầng 1 để đảm bảo f1 + f2 === stock luôn đúng
    const diff = total - (f1 + f2);
    if (f1 + diff >= 0) {
      f1 += diff;
    } else {
      f2 = Math.max(0, total - f1);
    }
  }

  return {
    stockFloor1: f1,
    stockFloor2: f2,
    stock: f1 + f2,
  };
}

/** Cộng (hoặc trừ) số lượng vào một tầng cụ thể */
export function applyFloorDelta(
  product: any,
  floor: WarehouseFloor,
  delta: number
): { stockFloor1: number; stockFloor2: number; stock: number } {
  const current = getFloorStocks(product);
  let f1 = current.stockFloor1;
  let f2 = current.stockFloor2;

  if (floor === 'FLOOR_2') {
    f2 = Math.max(0, f2 + delta);
  } else {
    f1 = Math.max(0, f1 + delta);
  }

  return {
    stockFloor1: f1,
    stockFloor2: f2,
    stock: f1 + f2,
  };
}

/**
 * Trừ tồn kho khi bán hàng tại POS hoặc xuất đổi:
 * Ưu tiên trừ tại Kho Tầng 1 trước, nếu thiếu thì trừ tiếp phần còn lại ở Kho Tầng 2.
 */
export function deductStockForSale(
  product: any,
  qty: number
): { stockFloor1: number; stockFloor2: number; stock: number } {
  const current = getFloorStocks(product);
  let f1 = current.stockFloor1;
  let f2 = current.stockFloor2;
  let remaining = Math.max(0, qty);

  const fromF1 = Math.min(f1, remaining);
  f1 -= fromF1;
  remaining -= fromF1;

  if (remaining > 0) {
    f2 = Math.max(0, f2 - remaining);
  }

  return {
    stockFloor1: f1,
    stockFloor2: f2,
    stock: f1 + f2,
  };
}
