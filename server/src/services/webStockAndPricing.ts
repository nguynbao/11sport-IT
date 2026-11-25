import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  orderRepo,
  productRepo,
  promotionRepo,
  stockMovementRepo,
  webSiteSettingRepo,
} from '../config/db';
import { memoryStore } from '../config/repository';
import { IProduct, IProductVariant } from '../models/Product';
import { OnlineStockMode } from '../models/WebSiteSetting';
import { ApiError } from '../utils/errors';
import { createPayosPaymentLink, getPayOSClient } from './payos.service';

export interface CartPriceItemInput {
  productId: string;
  variantKey?: string;
  quantity: number;
}

export interface PricedCartItem {
  productId: string;
  productCode: string;
  name: string;
  slug: string;
  unit: string;
  variantKey: string;
  variantCode: string;
  color: string;
  size: string;
  imageUrl: string;
  unitPrice: number;
  tierDiscountAmount: number;
  lineTotal: number;
  quantity: number;
  stockAvailable: number;
  inStock: boolean;
}

export interface EligibleGiftItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  imageUrl: string;
  quantity: number;
}

export interface CartPricingResult {
  items: PricedCartItem[];
  rawSubtotal: number;
  tierDiscountTotal: number;
  couponDiscount: number;
  couponApplied: { code: string; name: string } | null;
  couponError: string | null;
  eligibleGifts: EligibleGiftItem[];
  shippingFee: number;
  freeShipThreshold: number;
  totalAmount: number;
}

export interface StockDeductedEntry {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  variantKey: string;
  color: string;
  size: string;
  quantity: number;
  deductedFloor1: number;
  deductedFloor2: number;
}

export async function getOnlineSiteSetting() {
  const existing = await webSiteSettingRepo.findOne({ key: 'DEFAULT' });
  if (existing) return existing;
  return {
    key: 'DEFAULT',
    siteName: '11 Sport',
    defaultShippingFee: 30000,
    freeShipThreshold: 500000,
    onlineStockMode: 'FLOOR_1' as OnlineStockMode,
    cloudinaryCloudName: '',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: '',
    cloudinaryFolder: '11sport-web',
    showrooms: [],
    uspItems: [
      { icon: 'shield-check', title: 'Chính hãng 100%', description: 'Cam kết hàng chính hãng' },
      { icon: 'refresh-cw', title: 'Đổi trả 7 ngày', description: 'Hỗ trợ đổi size miễn phí' },
      { icon: 'truck', title: 'Giao nhanh 24h', description: 'Freeship đơn từ 500.000đ' },
      { icon: 'headphones', title: 'Tư vấn chuyên sâu', description: 'Đội ngũ HLV hỗ trợ' },
    ],
  };
}

export function resolveVariantEffectivePrice(product: IProduct, variant?: IProductVariant | null): number {
  if (variant && typeof variant.sellingPrice === 'number' && variant.sellingPrice > 0) {
    return Math.round(variant.sellingPrice);
  }
  return Math.round(Number(product.sellingPrice || 0));
}

export function getVariantAvailableStock(
  product: IProduct,
  variantKey: string | undefined,
  stockMode: OnlineStockMode
): { variant: IProductVariant | null; available: number; floor1: number; floor2: number } {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length > 0) {
    const matched =
      (variantKey && variants.find((v) => v.variantKey === variantKey || v.variantCode === variantKey)) ||
      variants[0];
    const f1 = Math.max(0, Number(matched.stockFloor1 || 0));
    const f2 = Math.max(0, Number(matched.stockFloor2 || 0));
    const available = stockMode === 'ALL' ? f1 + f2 : f1;
    return { variant: matched, available, floor1: f1, floor2: f2 };
  }
  const f1 = Math.max(0, Number(product.stockFloor1 ?? product.stock ?? 0));
  const f2 = Math.max(0, Number(product.stockFloor2 ?? 0));
  const available = stockMode === 'ALL' ? f1 + f2 : f1;
  return { variant: null, available, floor1: f1, floor2: f2 };
}

export function getProductTotalOnlineStock(product: IProduct, stockMode: OnlineStockMode): number {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length > 0) {
    return variants.reduce((sum, v) => {
      const f1 = Math.max(0, Number(v.stockFloor1 || 0));
      const f2 = Math.max(0, Number(v.stockFloor2 || 0));
      return sum + (stockMode === 'ALL' ? f1 + f2 : f1);
    }, 0);
  }
  const f1 = Math.max(0, Number(product.stockFloor1 ?? product.stock ?? 0));
  const f2 = Math.max(0, Number(product.stockFloor2 ?? 0));
  return stockMode === 'ALL' ? f1 + f2 : f1;
}

function resolveProductPrimaryImage(product: IProduct, variant?: IProductVariant | null): string {
  if (variant?.imageUrl) return variant.imageUrl;
  const imgs = Array.isArray(product.images) ? product.images : [];
  const primary = imgs.find((i) => i.isPrimary) || imgs[0];
  return primary?.url || '';
}

function isPromotionActiveNow(promo: any, now: Date): boolean {
  if (promo.status !== 'ACTIVE') return false;
  if (!Array.isArray(promo.applyChannels) || !promo.applyChannels.includes('ONLINE')) return false;
  if (promo.isPermanent) return true;
  if (promo.startDate && new Date(promo.startDate) > now) return false;
  if (promo.endDate && new Date(promo.endDate) < now) return false;
  return true;
}

export async function calculateCartPricing(params: {
  items: CartPriceItemInput[];
  couponCode?: string;
  province?: string;
}): Promise<CartPricingResult> {
  const itemsInput = Array.isArray(params.items) ? params.items : [];
  if (itemsInput.length === 0) {
    throw new ApiError(400, 'EMPTY_CART', 'Giỏ hàng đang trống');
  }

  const setting = await getOnlineSiteSetting();
  const stockMode: OnlineStockMode = (setting as any).onlineStockMode || 'FLOOR_1';
  const defaultShippingFee = Number((setting as any).defaultShippingFee ?? 30000);
  const freeShipThreshold = Number((setting as any).freeShipThreshold ?? 500000);

  const now = new Date();
  const allPromos = await promotionRepo.find({ status: 'ACTIVE' });
  const onlinePromos = allPromos.filter((p) => isPromotionActiveNow(p, now));

  const pricedItems: PricedCartItem[] = [];
  let rawSubtotal = 0;
  let tierDiscountTotal = 0;
  const productCategoryMap = new Map<string, string>();

  for (const row of itemsInput) {
    const qty = Math.floor(Number(row.quantity || 0));
    if (!row.productId || qty <= 0) {
      throw new ApiError(400, 'INVALID_QUANTITY', 'Số lượng sản phẩm không hợp lệ');
    }

    const product = await productRepo.findById(String(row.productId));
    if (!product || product.status !== 'ACTIVE' || !product.isPublishedOnline) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', `Sản phẩm ${row.productId} không tồn tại hoặc ngừng bán online`);
    }

    productCategoryMap.set(String(product._id), String(product.categoryId || ''));
    const { variant, available } = getVariantAvailableStock(product, row.variantKey, stockMode);
    const unitPrice = resolveVariantEffectivePrice(product, variant);
    if (unitPrice <= 0) {
      throw new ApiError(400, 'PRODUCT_PRICE_NOT_SET', `Sản phẩm ${product.name} chưa có giá bán`);
    }

    const lineRaw = unitPrice * qty;
    rawSubtotal += lineRaw;

    // Tính tier pricing tốt nhất cho sản phẩm này
    let bestTierDiscount = 0;
    for (const promo of onlinePromos) {
      if (promo.isCouponRequired) continue;
      const tiers = Array.isArray((promo as any).tierPricing) ? (promo as any).tierPricing : [];
      if (tiers.length === 0) continue;

      const matchesProduct =
        promo.conditionType === 'ALL_PRODUCTS' ||
        (promo.conditionType === 'BUY_PRODUCTS' &&
          (promo.conditionProductIds || []).map(String).includes(String(product._id))) ||
        (promo.conditionType === 'BUY_CATEGORY' &&
          (promo.conditionCategoryIds || []).map(String).includes(String(product.categoryId)));
      if (!matchesProduct) continue;

      const eligibleTiers = tiers.filter((t: any) => qty >= Number(t.minQty || 0));
      for (const tier of eligibleTiers) {
        const discount =
          tier.discountType === 'PERCENT'
            ? Math.round((lineRaw * Number(tier.discountValue || 0)) / 100)
            : Math.round(Number(tier.discountValue || 0) * qty);
        if (discount > bestTierDiscount) {
          bestTierDiscount = Math.min(discount, lineRaw);
        }
      }
    }

    tierDiscountTotal += bestTierDiscount;
    pricedItems.push({
      productId: String(product._id),
      productCode: product.code,
      name: product.name,
      slug: product.slug || '',
      unit: product.unit || 'Cái',
      variantKey: variant?.variantKey || 'DEFAULT',
      variantCode: variant?.variantCode || product.code,
      color: variant?.color || '',
      size: variant?.size || '',
      imageUrl: resolveProductPrimaryImage(product, variant),
      unitPrice,
      tierDiscountAmount: bestTierDiscount,
      lineTotal: Math.max(0, lineRaw - bestTierDiscount),
      quantity: qty,
      stockAvailable: available,
      inStock: available >= qty,
    });
  }

  const afterTierSubtotal = Math.max(0, rawSubtotal - tierDiscountTotal);

  // Kiểm tra quà tặng hợp lệ (chống trùng lặp theo productId)
  const giftMap = new Map<string, EligibleGiftItem>();
  for (const promo of onlinePromos) {
    if (promo.isCouponRequired) continue;
    const gifts = Array.isArray(promo.giftItems) ? promo.giftItems : [];
    if (gifts.length === 0) continue;
    if (afterTierSubtotal < Number(promo.minOrderAmount || 0)) continue;

    let totalConditionQty = 0;
    for (const item of pricedItems) {
      const catId = productCategoryMap.get(item.productId) || '';
      const matched =
        promo.conditionType === 'ALL_PRODUCTS' ||
        (promo.conditionType === 'BUY_PRODUCTS' &&
          (promo.conditionProductIds || []).map(String).includes(item.productId)) ||
        (promo.conditionType === 'BUY_CATEGORY' &&
          (promo.conditionCategoryIds || []).map(String).includes(catId));
      if (matched) totalConditionQty += item.quantity;
    }

    if (totalConditionQty >= Number(promo.minQuantity || 1)) {
      for (const g of gifts) {
        const gId = String(g.productId);
        if (!giftMap.has(gId)) {
          const giftProd = await productRepo.findById(gId);
          giftMap.set(gId, {
            productId: gId,
            productCode: g.productCode || giftProd?.code || '',
            productName: g.productName || giftProd?.name || '',
            unit: g.unit || giftProd?.unit || 'Cái',
            imageUrl: giftProd ? resolveProductPrimaryImage(giftProd, null) : '',
            quantity: Number(g.quantity || 1),
          });
        }
      }
    }
  }

  // Áp mã giảm giá (Coupon)
  let couponDiscount = 0;
  let couponApplied: { code: string; name: string } | null = null;
  let couponError: string | null = null;
  const cleanCoupon = String(params.couponCode || '').trim().toUpperCase();

  if (cleanCoupon) {
    const couponPromo = onlinePromos.find(
      (p) => (p as any).isCouponRequired && String((p as any).couponCode || '').toUpperCase() === cleanCoupon
    );
    if (!couponPromo) {
      couponError = 'Mã giảm giá không hợp lệ hoặc đã hết hạn';
    } else if (
      typeof (couponPromo as any).usageLimit === 'number' &&
      (couponPromo as any).usageLimit > 0 &&
      Number((couponPromo as any).usedCount || 0) >= Number((couponPromo as any).usageLimit)
    ) {
      couponError = 'Mã giảm giá đã hết lượt sử dụng';
    } else if (afterTierSubtotal < Number(couponPromo.minOrderAmount || 0)) {
      couponError = `Đơn hàng cần tối thiểu ${Number(couponPromo.minOrderAmount).toLocaleString('vi-VN')}đ để áp mã này`;
    } else {
      if (couponPromo.billDiscountType === 'PERCENT') {
        couponDiscount = Math.round((afterTierSubtotal * Number(couponPromo.billDiscountValue || 0)) / 100);
      } else if (couponPromo.billDiscountType === 'AMOUNT') {
        couponDiscount = Math.round(Number(couponPromo.billDiscountValue || 0));
      }
      couponDiscount = Math.min(couponDiscount, afterTierSubtotal);
      couponApplied = { code: cleanCoupon, name: couponPromo.name };
    }
  }

  const afterDiscount = Math.max(0, afterTierSubtotal - couponDiscount);
  const shippingFee = afterDiscount >= freeShipThreshold ? 0 : defaultShippingFee;
  const totalAmount = afterDiscount + shippingFee;

  return {
    items: pricedItems,
    rawSubtotal,
    tierDiscountTotal,
    couponDiscount,
    couponApplied,
    couponError,
    eligibleGifts: Array.from(giftMap.values()),
    shippingFee,
    freeShipThreshold,
    totalAmount,
  };
}

/**
 * Trừ / giữ chỗ tồn kho nguyên tử (atomic). Nếu item bất kỳ hết hàng, rollback toàn bộ các item đã trừ trước đó.
 */
export async function atomicDeductOnlineStock(
  items: { productId: string; variantKey: string; quantity: number }[],
  stockMode: OnlineStockMode
): Promise<StockDeductedEntry[]> {
  const deducted: StockDeductedEntry[] = [];
  const unavailableItems: { productId: string; variantKey: string; requested: number; available: number }[] = [];
  const isMongo = mongoose.connection.readyState === 1;

  for (const item of items) {
    const qty = Math.floor(Number(item.quantity || 0));
    const product = await productRepo.findById(item.productId);
    if (!product) {
      unavailableItems.push({ productId: item.productId, variantKey: item.variantKey, requested: qty, available: 0 });
      continue;
    }

    const { variant, available, floor1 } = getVariantAvailableStock(product, item.variantKey, stockMode);
    const targetVariantKey = variant?.variantKey || 'DEFAULT';
    if (available < qty) {
      unavailableItems.push({
        productId: item.productId,
        variantKey: targetVariantKey,
        requested: qty,
        available,
      });
      continue;
    }

    const deductF1 = Math.min(floor1, qty);
    const deductF2 = qty - deductF1;

    if (isMongo) {
      const ProductModel = mongoose.model('Product');
      if (variant) {
        const cond: Record<string, unknown> = {
          _id: item.productId,
          variants: {
            $elemMatch: {
              variantKey: targetVariantKey,
              ...(deductF1 > 0 ? { stockFloor1: { $gte: deductF1 } } : {}),
              ...(deductF2 > 0 ? { stockFloor2: { $gte: deductF2 } } : {}),
            },
          },
        };
        const updated = await ProductModel.findOneAndUpdate(
          cond,
          {
            $inc: {
              'variants.$.stockFloor1': -deductF1,
              'variants.$.stockFloor2': -deductF2,
              'variants.$.stock': -qty,
              stockFloor1: -deductF1,
              stockFloor2: -deductF2,
              stock: -qty,
            },
          },
          { new: true }
        );
        if (!updated) {
          unavailableItems.push({
            productId: item.productId,
            variantKey: targetVariantKey,
            requested: qty,
            available: 0,
          });
          continue;
        }
      } else {
        const updated = await ProductModel.findOneAndUpdate(
          {
            _id: item.productId,
            ...(deductF1 > 0 ? { stockFloor1: { $gte: deductF1 } } : {}),
            ...(deductF2 > 0 ? { stockFloor2: { $gte: deductF2 } } : {}),
            stock: { $gte: qty },
          },
          {
            $inc: {
              stockFloor1: -deductF1,
              stockFloor2: -deductF2,
              stock: -qty,
            },
          },
          { new: true }
        );
        if (!updated) {
          unavailableItems.push({
            productId: item.productId,
            variantKey: targetVariantKey,
            requested: qty,
            available: 0,
          });
          continue;
        }
      }
    } else {
      // In-memory store: thao tác đồng bộ trên collection record đảm bảo atomic trong Node event loop
      const col = memoryStore.getCollection('products');
      const idx = col.findIndex((d) => String(d._id) === String(item.productId));
      if (idx === -1) {
        unavailableItems.push({ productId: item.productId, variantKey: targetVariantKey, requested: qty, available: 0 });
        continue;
      }
      const doc = col[idx];
      const variants = Array.isArray(doc.variants) ? doc.variants : [];
      if (variants.length > 0) {
        const vIdx = variants.findIndex((v: any) => v.variantKey === targetVariantKey);
        if (vIdx === -1) {
          unavailableItems.push({ productId: item.productId, variantKey: targetVariantKey, requested: qty, available: 0 });
          continue;
        }
        const v = variants[vIdx];
        const curF1 = Number(v.stockFloor1 || 0);
        const curF2 = Number(v.stockFloor2 || 0);
        const curAvail = stockMode === 'ALL' ? curF1 + curF2 : curF1;
        if (curAvail < qty) {
          unavailableItems.push({ productId: item.productId, variantKey: targetVariantKey, requested: qty, available: curAvail });
          continue;
        }
        const df1 = Math.min(curF1, qty);
        const df2 = qty - df1;
        v.stockFloor1 = curF1 - df1;
        v.stockFloor2 = curF2 - df2;
        v.stock = v.stockFloor1 + v.stockFloor2;
        doc.stockFloor1 = variants.reduce((s: number, x: any) => s + Number(x.stockFloor1 || 0), 0);
        doc.stockFloor2 = variants.reduce((s: number, x: any) => s + Number(x.stockFloor2 || 0), 0);
        doc.stock = doc.stockFloor1 + doc.stockFloor2;
        deducted.push({
          productId: String(doc._id),
          productCode: doc.code,
          productName: doc.name,
          unit: doc.unit || 'Cái',
          variantKey: targetVariantKey,
          color: v.color || '',
          size: v.size || '',
          quantity: qty,
          deductedFloor1: df1,
          deductedFloor2: df2,
        });
        continue;
      } else {
        const curF1 = Number(doc.stockFloor1 ?? doc.stock ?? 0);
        const curF2 = Number(doc.stockFloor2 ?? 0);
        const curAvail = stockMode === 'ALL' ? curF1 + curF2 : curF1;
        if (curAvail < qty) {
          unavailableItems.push({ productId: item.productId, variantKey: targetVariantKey, requested: qty, available: curAvail });
          continue;
        }
        const df1 = Math.min(curF1, qty);
        const df2 = qty - df1;
        doc.stockFloor1 = curF1 - df1;
        doc.stockFloor2 = curF2 - df2;
        doc.stock = doc.stockFloor1 + doc.stockFloor2;
        deducted.push({
          productId: String(doc._id),
          productCode: doc.code,
          productName: doc.name,
          unit: doc.unit || 'Cái',
          variantKey: targetVariantKey,
          color: '',
          size: '',
          quantity: qty,
          deductedFloor1: df1,
          deductedFloor2: df2,
        });
        continue;
      }
    }

    deducted.push({
      productId: String(product._id),
      productCode: product.code,
      productName: product.name,
      unit: product.unit || 'Cái',
      variantKey: targetVariantKey,
      color: variant?.color || '',
      size: variant?.size || '',
      quantity: qty,
      deductedFloor1: deductF1,
      deductedFloor2: deductF2,
    });
  }

  if (unavailableItems.length > 0) {
    if (deducted.length > 0) {
      await atomicRestoreOnlineStock(
        deducted.map((d) => ({
          productId: d.productId,
          variantKey: d.variantKey,
          quantity: d.quantity,
          floor1: d.deductedFloor1,
          floor2: d.deductedFloor2,
        }))
      );
    }
    throw new ApiError(409, 'INSUFFICIENT_STOCK', 'Một số sản phẩm trong giỏ không đủ tồn kho', {
      unavailableItems: JSON.stringify(unavailableItems),
    });
  }

  return deducted;
}

export async function atomicRestoreOnlineStock(
  items: { productId: string; variantKey?: string; quantity: number; floor1?: number; floor2?: number }[]
): Promise<void> {
  const isMongo = mongoose.connection.readyState === 1;
  for (const item of items) {
    const qty = Math.floor(Number(item.quantity || 0));
    if (qty <= 0) continue;
    const f1 = typeof item.floor1 === 'number' ? item.floor1 : qty;
    const f2 = typeof item.floor2 === 'number' ? item.floor2 : 0;

    if (isMongo) {
      const ProductModel = mongoose.model('Product');
      if (item.variantKey && item.variantKey !== 'DEFAULT') {
        await ProductModel.updateOne(
          { _id: item.productId, 'variants.variantKey': item.variantKey },
          {
            $inc: {
              'variants.$.stockFloor1': f1,
              'variants.$.stockFloor2': f2,
              'variants.$.stock': qty,
              stockFloor1: f1,
              stockFloor2: f2,
              stock: qty,
            },
          }
        );
      } else {
        await ProductModel.updateOne(
          { _id: item.productId },
          { $inc: { stockFloor1: f1, stockFloor2: f2, stock: qty } }
        );
      }
    } else {
      const col = memoryStore.getCollection('products');
      const doc = col.find((d) => String(d._id) === String(item.productId));
      if (!doc) continue;
      const variants = Array.isArray(doc.variants) ? doc.variants : [];
      if (variants.length > 0) {
        const v = variants.find((x: any) => x.variantKey === item.variantKey) || variants[0];
        v.stockFloor1 = Number(v.stockFloor1 || 0) + f1;
        v.stockFloor2 = Number(v.stockFloor2 || 0) + f2;
        v.stock = v.stockFloor1 + v.stockFloor2;
        doc.stockFloor1 = variants.reduce((s: number, x: any) => s + Number(x.stockFloor1 || 0), 0);
        doc.stockFloor2 = variants.reduce((s: number, x: any) => s + Number(x.stockFloor2 || 0), 0);
        doc.stock = doc.stockFloor1 + doc.stockFloor2;
      } else {
        doc.stockFloor1 = Number(doc.stockFloor1 || 0) + f1;
        doc.stockFloor2 = Number(doc.stockFloor2 || 0) + f2;
        doc.stock = doc.stockFloor1 + doc.stockFloor2;
      }
    }
  }
}

export async function generateOnlineOrderCode(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `ONL-${y}${m}${d}-`;
  const existing = await orderRepo.find({
    orderCode: { $regex: `^${prefix}` },
  });
  const nextSeq = existing.length + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

export function verifyPayosWebhookSignature(
  rawBody: Record<string, unknown>,
  signature: string,
  checksumKey: string
): boolean {
  if (!signature || !checksumKey) return false;
  const data = (rawBody.data && typeof rawBody.data === 'object' ? rawBody.data : rawBody) as Record<
    string,
    unknown
  >;
  const sortedKeys = Object.keys(data)
    .filter((k) => k !== 'signature')
    .sort();
  const queryStr = sortedKeys
    .map((k) => {
      const v = data[k];
      const strVal = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${k}=${strVal}`;
    })
    .join('&');
  const expected = crypto.createHmac('sha256', checksumKey).update(queryStr).digest('hex');
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}

export async function createPayosOrVietQrPayment(params: {
  orderCode: string;
  payosOrderCode?: number;
  amount: number;
  description: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}): Promise<{ paymentUrl: string; qrCode: string; payosOrderCode: number }> {
  const numericOrderCode =
    params.payosOrderCode ||
    Number(`${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`);

  const shopUrl = process.env.SHOP_URL || 'http://localhost:3002';
  const returnUrl = `${shopUrl}/thanh-toan/order-received/${encodeURIComponent(params.orderCode)}`;
  const cancelUrl = `${shopUrl}/thanh-toan?cancelled=1`;

  const payosClient = getPayOSClient();
  if (payosClient) {
    try {
      const linkRes = await createPayosPaymentLink({
        orderCode: numericOrderCode,
        amount: params.amount,
        description: params.description || `DH ${numericOrderCode}`,
        returnUrl,
        cancelUrl,
        items: params.items,
      });

      if (linkRes?.checkoutUrl) {
        return {
          paymentUrl: linkRes.checkoutUrl,
          qrCode: linkRes.qrCode || linkRes.checkoutUrl,
          payosOrderCode: numericOrderCode,
        };
      }
    } catch (err) {
      console.error('[PayOS] SDK createPaymentLink failed, fallback to VietQR:', err);
    }
  }

  // Fallback VietQR khi chưa cấu hình key PayOS hoặc chạy test/dev
  const bankId = process.env.VIETQR_BANK_ID || 'MB';
  const accountNo = process.env.VIETQR_ACCOUNT_NO || '000011SPORT';
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${params.amount}&addInfo=${encodeURIComponent(params.orderCode)}`;
  return {
    paymentUrl: qrUrl,
    qrCode: qrUrl,
    payosOrderCode: numericOrderCode,
  };
}

/**
 * Job giải phóng giữ chỗ tồn kho cho các đơn thanh toán QR quá hạn 15 phút (AC-05).
 */
export async function releaseExpiredQrOrders(now: Date = new Date()): Promise<number> {
  const candidates = await orderRepo.find({
    channel: 'ONLINE',
    paymentStatus: 'UNPAID',
  });

  let releasedCount = 0;
  for (const order of candidates) {
    if (order.paymentGateway !== 'PAYOS' && order.paymentGateway !== 'VIETQR') continue;
    if (order.fulfillmentStatus === 'CANCELLED') continue;
    if (!order.reservedUntil || new Date(order.reservedUntil) >= now) continue;

    await orderRepo.updateById(String(order._id), {
      paymentStatus: 'EXPIRED',
      fulfillmentStatus: 'CANCELLED',
    });

    const restoreItems = (order.items || []).map((it: any) => ({
      productId: String(it.productId),
      variantKey: it.color || it.size ? `${it.color || ''}_${it.size || ''}` : 'DEFAULT',
      quantity: Number(it.quantity || 0),
    }));
    // Khôi phục chính xác theo variantKey nếu có trong product
    const resolvedRestoreItems: { productId: string; variantKey?: string; quantity: number }[] = [];
    for (const it of order.items || []) {
      const prod = await productRepo.findById(String(it.productId));
      const matchedVariant = prod?.variants?.find(
        (v) => v.color === (it.color || '') && v.size === (it.size || '')
      );
      resolvedRestoreItems.push({
        productId: String(it.productId),
        variantKey: matchedVariant?.variantKey || 'DEFAULT',
        quantity: Number(it.quantity || 0),
      });
    }
    await atomicRestoreOnlineStock(
      resolvedRestoreItems.length > 0 ? resolvedRestoreItems : restoreItems
    );

    for (const it of order.items || []) {
      await stockMovementRepo.create({
        productId: String(it.productId),
        productCode: it.productCode || '',
        productName: it.productName || '',
        color: it.color || '',
        size: it.size || '',
        warehouseLocation: 'FLOOR_1',
        type: 'ADJUSTMENT',
        categoryId: '',
        unit: it.unit || 'Cái',
        quantityChange: Number(it.quantity || 0),
        balanceBefore: 0,
        balanceAfter: 0,
        referenceType: 'ADJUSTMENT',
        referenceId: String(order._id),
        referenceCode: order.orderCode,
        note: `Hoàn kho tự động do đơn QR ${order.orderCode} quá hạn 15 phút`,
        performedBy: 'SYSTEM',
        performedByName: 'Hệ thống',
      });
    }

    releasedCount += 1;
  }

  return releasedCount;
}
