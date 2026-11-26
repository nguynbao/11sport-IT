import type { DiscountType, Order, Product } from "@/shared/types";
import { findVariantByColorSize, variantEffectiveSellingPrice } from "@/shared/utils/productCode";

export const PINNED_GIFTS_STORAGE_KEY = "11sport_pos_pinned_gift_ids";

export interface GiftCartItem {
  product: Product;
  quantity: number;
  color?: string;
  size?: string;
  isAutoPromo?: boolean;
  promoName?: string;
}

export interface PosTabProps {
  onOpenInvoice: (order: Order) => void;
}

export interface CartItem {
  product: Product;
  color?: string;
  size?: string;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  discountInputMode?: "NONE" | "PERCENT" | "AMOUNT" | "PRICE";
  customPriceText?: string;
  isManualDiscount?: boolean;
  autoPromoName?: string;
}

/** R8 (v5.0): giá bán hiệu lực của dòng giỏ hàng = giá biến thể (Màu+Size) nếu > 0, ngược lại giá gốc */
export const cartUnitPrice = (ci: { product: Product; color?: string; size?: string }): number =>
  Math.round(variantEffectiveSellingPrice(ci.product, findVariantByColorSize(ci.product, ci.color, ci.size)) || 0);

/** Giá hiển thị của sản phẩm trên lưới POS: giá gốc, hoặc giá thấp nhất của biến thể nếu gốc chưa có giá */
export const productDisplayPrice = (p: Product): { price: number; minPrice: number; maxPrice: number; hasVariantPrices: boolean } => {
  const vars = Array.isArray(p.variants) ? p.variants : [];
  const prices = vars.map((v) => variantEffectiveSellingPrice(p, v)).filter((x) => x > 0);
  const base = Number(p.sellingPrice || 0);
  const hasVariantPrices = vars.some((v) => Number(v.sellingPrice || 0) > 0 && Number(v.sellingPrice) !== base);
  const minPrice = prices.length ? Math.min(...prices) : base;
  const maxPrice = prices.length ? Math.max(...prices) : base;
  if (base > 0) return { price: base, minPrice: Math.min(minPrice, base), maxPrice: Math.max(maxPrice, base), hasVariantPrices };
  return { price: minPrice, minPrice, maxPrice, hasVariantPrices };
};

export const getCartLineKey = (productId: string, color?: string, size?: string): string =>
  `${productId}__${String(color || "").trim().toLowerCase()}__${String(size || "").trim().toUpperCase()}`;

export type SortByOption = "CATEGORY" | "NAME_ASC" | "PRICE_ASC" | "PRICE_DESC" | "STOCK_DESC";
export type SplitMethodType = "CASH" | "BANKING" | "CARD" | "DEBT";

export interface SplitPaymentItem {
  method: SplitMethodType;
  amount: number;
}

export const SPLIT_METHOD_OPTIONS: { value: SplitMethodType; label: string }[] = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "BANKING", label: "Chuyển khoản" },
  { value: "CARD", label: "Card" },
  { value: "DEBT", label: "Công nợ (Trả sau)" },
];

// ===== Nhiều đơn hàng song song (đơn nháp) =====
export const POS_DRAFTS_STORAGE_KEY = "11sport_pos_drafts_v1";
export const MAX_DRAFTS = 10;
export const DEFAULT_NOTE = "Giá đã bao gồm thuế";

export type PaymentMethodType = "CASH" | "BANKING" | "CARD" | "OTHER";

export interface DraftOrderData {
  cart: CartItem[];
  giftCart: GiftCartItem[];
  billDiscountType: DiscountType;
  billDiscountValue: number;
  billDiscountInputMode?: "NONE" | "PERCENT" | "AMOUNT" | "PRICE";
  billCustomPriceText?: string;
  customerPhone: string;
  customerName: string;
  isExistingCustomer: boolean;
  customerOrders: Order[];
  customerDebtSummary?: {
    totalDebtAmount: number;
    unpaidOrdersCount: number;
    overdueOrdersCount: number;
  } | null;
  paymentMethod: PaymentMethodType;
  splitPayments: SplitPaymentItem[];
  debtDueDate?: string;
  hasCardFee: boolean;
  cardFeePercent?: number;
  note: string;
  editingServerDraftOrder?: Order | null;
}

export interface DraftOrder extends DraftOrderData {
  id: string;
  seq: number;
}

export const createEmptyDraftData = (): DraftOrderData => ({
  cart: [],
  giftCart: [],
  billDiscountType: "NONE",
  billDiscountValue: 0,
  customerPhone: "",
  customerName: "",
  isExistingCustomer: false,
  customerOrders: [],
  customerDebtSummary: null,
  paymentMethod: "CASH",
  splitPayments: [],
  debtDueDate: "",
  hasCardFee: true,
  cardFeePercent: 1.8,
  note: DEFAULT_NOTE,
  editingServerDraftOrder: null,
});

export const generateDraftId = () =>
  `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const createDraft = (seq: number): DraftOrder => ({
  id: generateDraftId(),
  seq,
  ...createEmptyDraftData(),
});

export const isDraftEmpty = (d: DraftOrderData) =>
  d.cart.length === 0 &&
  d.giftCart.length === 0 &&
  !d.customerPhone.trim() &&
  !d.customerName.trim() &&
  !d.editingServerDraftOrder;

export const INITIAL_DRAFT_ID = "draft_initial";

