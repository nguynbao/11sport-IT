import { WarehouseFloor, IProductVariant } from '../models/Product';
import { buildVariantKey } from './productCode';

export function normalizeFloor(val?: any): WarehouseFloor {
  return String(val || '').toUpperCase() === 'FLOOR_2' ? 'FLOOR_2' : 'FLOOR_1';
}

export function floorLabel(floor?: any): string {
  return normalizeFloor(floor) === 'FLOOR_2' ? 'Kho Tầng 2' : 'Kho Tầng 1';
}

/**
 * Chuẩn hóa danh sách variants của sản phẩm (gộp trùng khóa variantKey nếu có).
 */
export function normalizeVariants(rawVariants?: any[]): IProductVariant[] {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) return [];
  const map = new Map<string, IProductVariant>();

  for (const raw of rawVariants) {
    if (!raw || typeof raw !== 'object') continue;
    const color = String(raw.color || '').trim();
    const size = String(raw.size || '').trim();
    const variantKey = buildVariantKey(color, size);
    const f1 = Math.max(0, Math.round(Number(raw.stockFloor1) || 0));
    const f2 = Math.max(0, Math.round(Number(raw.stockFloor2) || 0));
    const explicitStock = raw.stock !== undefined ? Math.max(0, Math.round(Number(raw.stock) || 0)) : f1 + f2;
    const finalF1 = f1 === 0 && f2 === 0 && explicitStock > 0 ? explicitStock : f1;
    const finalF2 = f2;
    const existing = map.get(variantKey);

    if (existing) {
      existing.stockFloor1 += finalF1;
      existing.stockFloor2 += finalF2;
      existing.stock = existing.stockFloor1 + existing.stockFloor2;
    } else {
      map.set(variantKey, {
        variantKey,
        color,
        size,
        stockFloor1: finalF1,
        stockFloor2: finalF2,
        stock: finalF1 + finalF2,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Tính tổng tồn Tầng 1, Tầng 2 và Tổng tồn từ danh sách variants.
 */
export function summarizeVariants(rawVariants?: any[]): {
  variants: IProductVariant[];
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
} {
  const variants = normalizeVariants(rawVariants);
  const stockFloor1 = variants.reduce((sum, v) => sum + v.stockFloor1, 0);
  const stockFloor2 = variants.reduce((sum, v) => sum + v.stockFloor2, 0);
  return {
    variants,
    stockFloor1,
    stockFloor2,
    stock: stockFloor1 + stockFloor2,
  };
}

/**
 * Chuẩn hóa tồn kho theo 2 tầng từ bản ghi Product.
 * Nếu sản phẩm có variants[], tổng tồn luôn được đồng bộ từ variants[].
 */
export function getFloorStocks(product: any): {
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
  variants: IProductVariant[];
} {
  const variants = normalizeVariants(product?.variants);
  if (variants.length > 0) {
    const f1 = variants.reduce((s, v) => s + v.stockFloor1, 0);
    const f2 = variants.reduce((s, v) => s + v.stockFloor2, 0);
    return {
      stockFloor1: f1,
      stockFloor2: f2,
      stock: f1 + f2,
      variants,
    };
  }

  const total = Math.max(0, Number(product?.stock) || 0);
  const hasF1 = product?.stockFloor1 !== undefined && product?.stockFloor1 !== null;
  const hasF2 = product?.stockFloor2 !== undefined && product?.stockFloor2 !== null;

  let f1 = Math.max(0, Number(product?.stockFloor1) || 0);
  let f2 = Math.max(0, Number(product?.stockFloor2) || 0);

  if ((!hasF1 && !hasF2) || (f1 === 0 && f2 === 0 && total > 0)) {
    f1 = total;
    f2 = 0;
  } else if (f1 + f2 !== total) {
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
    variants: [],
  };
}

/**
 * Lấy tồn kho của 1 phân loại (color, size) cụ thể hoặc toàn bộ sản phẩm nếu không truyền color/size.
 */
export function getVariantFloorStocks(
  product: any,
  color?: string,
  size?: string
): {
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
  matchedVariant?: IProductVariant;
} {
  const cleanColor = String(color || '').trim();
  const cleanSize = String(size || '').trim();
  const base = getFloorStocks(product);

  if (!cleanColor && !cleanSize) {
    return base;
  }

  const targetKey = buildVariantKey(cleanColor, cleanSize);
  const matched = base.variants.find((v) => v.variantKey === targetKey);
  if (matched) {
    return {
      stockFloor1: matched.stockFloor1,
      stockFloor2: matched.stockFloor2,
      stock: matched.stock,
      matchedVariant: matched,
    };
  }

  // Nếu sản phẩm chưa chia variants mà chỉ có tồn chung và chưa có phân loại nào khác
  if (base.variants.length === 0) {
    return base;
  }

  return {
    stockFloor1: 0,
    stockFloor2: 0,
    stock: 0,
  };
}

/** Cộng (hoặc trừ) số lượng vào một tầng cụ thể (hỗ trợ cả biến thể color + size) */
export function applyFloorDelta(
  product: any,
  floor: WarehouseFloor,
  delta: number,
  color?: string,
  size?: string
): {
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
  variants: IProductVariant[];
  balanceBefore: number;
  balanceAfter: number;
} {
  const current = getFloorStocks(product);
  const balanceBefore = current.stock;
  const cleanColor = String(color || '').trim();
  const cleanSize = String(size || '').trim();
  const hasVariantSpec = Boolean(cleanColor || cleanSize);

  // Nếu có truyền color/size hoặc sản phẩm đang quản lý theo variants
  if (hasVariantSpec || current.variants.length > 0) {
    const variants = current.variants.map((v) => ({ ...v }));

    // Nếu sản phẩm trước đó có tồn chung (variants rỗng) mà bây giờ thêm biến thể đầu tiên:
    // giữ nguyên tồn cũ vào biến thể DEFAULT (nếu tồn cũ > 0 và biến thể mới khác DEFAULT)
    if (variants.length === 0 && (current.stockFloor1 > 0 || current.stockFloor2 > 0) && hasVariantSpec) {
      variants.push({
        variantKey: 'DEFAULT',
        color: '',
        size: '',
        stockFloor1: current.stockFloor1,
        stockFloor2: current.stockFloor2,
        stock: current.stock,
      });
    }

    const targetKey = hasVariantSpec
      ? buildVariantKey(cleanColor, cleanSize)
      : variants[0]?.variantKey || 'DEFAULT';

    let targetVariant = variants.find((v) => v.variantKey === targetKey);
    if (!targetVariant) {
      targetVariant = {
        variantKey: targetKey,
        color: cleanColor,
        size: cleanSize,
        stockFloor1: 0,
        stockFloor2: 0,
        stock: 0,
      };
      variants.push(targetVariant);
    }

    if (floor === 'FLOOR_2') {
      targetVariant.stockFloor2 = Math.max(0, targetVariant.stockFloor2 + delta);
    } else {
      targetVariant.stockFloor1 = Math.max(0, targetVariant.stockFloor1 + delta);
    }
    targetVariant.stock = targetVariant.stockFloor1 + targetVariant.stockFloor2;

    const summary = summarizeVariants(variants);
    return {
      stockFloor1: summary.stockFloor1,
      stockFloor2: summary.stockFloor2,
      stock: summary.stock,
      variants: summary.variants,
      balanceBefore,
      balanceAfter: summary.stock,
    };
  }

  let f1 = current.stockFloor1;
  let f2 = current.stockFloor2;

  if (floor === 'FLOOR_2') {
    f2 = Math.max(0, f2 + delta);
  } else {
    f1 = Math.max(0, f1 + delta);
  }

  const stock = f1 + f2;

  return {
    stockFloor1: f1,
    stockFloor2: f2,
    stock,
    variants: [],
    balanceBefore,
    balanceAfter: stock,
  };
}

/**
 * Trừ tồn kho khi bán hàng tại POS hoặc xuất đổi:
 * CHỈ trừ tại Kho Tầng 1 (stockFloor1). Hỗ trợ trừ chính xác vào biến thể (color, size).
 */
export function deductStockForSale(
  product: any,
  qty: number,
  color?: string,
  size?: string
): {
  stockFloor1: number;
  stockFloor2: number;
  stock: number;
  variants: IProductVariant[];
} {
  const current = getFloorStocks(product);
  const amount = Math.max(0, qty);
  const cleanColor = String(color || '').trim();
  const cleanSize = String(size || '').trim();

  if (current.variants.length > 0) {
    const variants = current.variants.map((v) => ({ ...v }));
    const targetKey = cleanColor || cleanSize ? buildVariantKey(cleanColor, cleanSize) : '';
    const matched = targetKey ? variants.find((v) => v.variantKey === targetKey) : undefined;

    if (matched) {
      matched.stockFloor1 = Math.max(0, matched.stockFloor1 - amount);
      matched.stock = matched.stockFloor1 + matched.stockFloor2;
    } else {
      // Nếu không chỉ định biến thể cụ thể, trừ lần lượt vào các biến thể đang còn tồn ở Tầng 1
      let remaining = amount;
      for (const v of variants) {
        if (remaining <= 0) break;
        const take = Math.min(v.stockFloor1, remaining);
        v.stockFloor1 -= take;
        v.stock = v.stockFloor1 + v.stockFloor2;
        remaining -= take;
      }
    }

    const summary = summarizeVariants(variants);
    return {
      stockFloor1: summary.stockFloor1,
      stockFloor2: summary.stockFloor2,
      stock: summary.stock,
      variants: summary.variants,
    };
  }

  const f1 = Math.max(0, current.stockFloor1 - amount);
  const f2 = current.stockFloor2;

  return {
    stockFloor1: f1,
    stockFloor2: f2,
    stock: f1 + f2,
    variants: [],
  };
}

/**
 * Định dạng tên sản phẩm kèm nhãn (Màu - Size) để hiển thị trên Sổ kho / Hóa đơn.
 */
export function formatProductWithVariant(name: string, color?: string, size?: string): string {
  const base = String(name || '').trim();
  const c = String(color || '').trim();
  const s = String(size || '').trim();
  if (!c && !s) return base;
  const parts: string[] = [];
  if (c) parts.push(`Màu: ${c}`);
  if (s) parts.push(`Size: ${s}`);
  return `${base} (${parts.join(' - ')})`;
}
