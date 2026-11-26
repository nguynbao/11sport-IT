export type DiscountType = "NONE" | "PERCENT" | "AMOUNT" | "GIFT";

export interface OrderItem {
  productId: string;
  productCode: string;
  productName: string;
  color?: string;
  size?: string;
  unit: string;
  originalUnitPrice?: number;
  isGift?: boolean;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  unitPrice: number;
  unitCost?: number;
  quantity: number;
  returnedQuantity?: number;
  lineTotal: number;
}

export type DebtStatus = "NONE" | "UNPAID" | "PARTIAL" | "SETTLED";

export interface SplitPaymentRecord {
  method: "CASH" | "BANKING" | "CARD" | "DEBT";
  amount: number;
}

export interface DebtPaymentRecord {
  _id?: string;
  amount: number;
  method: "CASH" | "BANKING" | "CARD";
  note?: string;
  paidAt: string;
  collectedBy?: string;
  collectedByName?: string;
}

export interface DebtAdjustmentRecord {
  _id?: string;
  type?: "RETURN" | string;
  returnId?: string;
  returnCode?: string;
  amount: number;
  debtBefore?: number;
  debtAfter?: number;
  reason?: "RETURN" | string;
  note?: string;
  at?: string;
  adjustedAt?: string;
  by?: string;
  byName?: string;
  performedBy?: string;
  performedByName?: string;
}

export interface Order {
  _id: string;
  orderCode: string;
  code?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "CASH" | "BANKING" | "CARD" | "OTHER";
  paymentMethodDetail?: string;
  splitPayments?: SplitPaymentRecord[];
  hasCardFee: boolean;
  cardFeePercent?: number;
  rawSubtotal?: number;
  itemDiscountTotal?: number;
  subtotal: number;
  billDiscountType?: DiscountType;
  billDiscountValue?: number;
  billDiscountAmount?: number;
  cardFee: number;
  totalAmount: number;
  paidAmount?: number;
  debtAmount?: number;
  initialDebtAmount?: number;
  debtStatus?: DebtStatus;
  debtDueDate?: string | null;
  debtPayments?: DebtPaymentRecord[];
  debtAdjustments?: DebtAdjustmentRecord[];
  note: string;
  status: "DRAFT" | "PAID" | "PARTIALLY_RETURNED" | "FULLY_RETURNED";
  shiftDate?: string;
  shiftCode?: "SHIFT_1" | "SHIFT_2" | "BOTH";
  items: OrderItem[];
  soldBy?: string;
  soldByName?: string;
  createdBy?: string;
  confirmedBy?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  createdByName?: string;
  createdAt: string;
}

export interface ReturnCalculateResult {
  orderId: string;
  orderCode: string;
  type: "RETURN" | "EXCHANGE";
  returnItems: {
    productId: string;
    productCode: string;
    productName: string;
    color?: string;
    size?: string;
    unit?: string;
    unitPrice: number;
    unitCost?: number;
    quantity: number;
    condition: "GOOD" | "DAMAGED";
    lineTotal: number;
  }[];
  exchangeItems: {
    productId: string;
    productCode: string;
    productName: string;
    color?: string;
    size?: string;
    unit?: string;
    originalUnitPrice?: number;
    discountType?: DiscountType;
    discountValue?: number;
    discountAmount?: number;
    unitPrice: number;
    unitCost?: number;
    quantity: number;
    lineTotal: number;
  }[];
  returnSubtotal: number;
  refundedCardFee: number;
  returnTotal: number;
  exchangeTotal: number;
  returnListedTotal?: number;
  exchangeListedTotal?: number;
  listedShortfall?: number;
  isDowngrade?: boolean;
  canOverrideDowngrade?: boolean;
  netDifference: number;
  refundAmount: number;
  additionalCharge: number;
  debtBefore: number;
  debtReduction: number;
  cashRefund: number;
  debtAfter: number;
  debtStatusAfter?: DebtStatus;
  explanation?: string;
}

export interface ReturnReceipt {
  _id: string;
  returnCode: string;
  code?: string;
  orderId: string;
  orderCode: string;
  customerName?: string;
  customerPhone?: string;
  type: "RETURN" | "EXCHANGE";
  refundMethod: "CASH" | "BANKING" | "CARD";
  returnItems: {
    productId: string;
    productCode: string;
    productName: string;
    color?: string;
    size?: string;
    unit?: string;
    unitPrice: number;
    unitCost?: number;
    quantity: number;
    condition: "GOOD" | "DAMAGED";
    lineTotal: number;
  }[];
  exchangeItems: {
    productId: string;
    productCode: string;
    productName: string;
    color?: string;
    size?: string;
    unit?: string;
    originalUnitPrice?: number;
    discountType?: DiscountType;
    discountValue?: number;
    discountAmount?: number;
    unitPrice: number;
    unitCost?: number;
    quantity: number;
    lineTotal: number;
  }[];
  returnSubtotal?: number;
  refundedCardFee?: number;
  returnTotal: number;
  exchangeTotal: number;
  netDifference: number;
  refundAmount?: number;
  additionalCharge?: number;
  debtBefore?: number;
  debtReduction?: number;
  cashRefund?: number;
  debtAfter?: number;
  debtStatusAfter?: DebtStatus;
  note?: string;
  performedByName?: string;
  createdAt: string;
}

export interface CurrentShiftOrdersSummary {
  paidOrdersCount: number;
  draftOrdersCount: number;
  totalRevenue: number;
  cashTotal: number;
  bankingTotal: number;
  cardTotal: number;
  debtTotal: number;
}

export interface CurrentShiftOrdersMeta {
  total: number;
  date: string;
  dateFilter?: string;
  allowedDates?: string[];
  minDate?: string;
  maxDate?: string;
  maxDays?: number;
  staffShift?: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH" | "OFF";
  shiftLabel: string;
  summary: CurrentShiftOrdersSummary;
}
