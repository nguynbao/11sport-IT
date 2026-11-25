export type ServiceOrderStatus =
  | "RECEIVED"
  | "IN_PROGRESS"
  | "READY"
  | "RETURNED"
  | "CANCELLED";

export type ServicePaymentStatus = "UNPAID" | "PARTIAL" | "PAID";
export type ServicePaymentMethod = "CASH" | "BANKING" | "CARD";

export interface ServiceType {
  _id: string;
  code: string;
  name: string;
  defaultPrice: number;
  unit: string;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  orderCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ServiceDiscountType = "NONE" | "PERCENT" | "AMOUNT";

export interface ServiceOrderItem {
  serviceTypeId: string;
  serviceCode: string;
  serviceName: string;
  unit: string;
  defaultPrice: number;
  unitPrice: number;
  quantity: number;
  discountType?: ServiceDiscountType;
  discountValue?: number;
  discountAmount?: number;
  lineTotal: number;
  itemNote?: string;
}

export interface ServicePaymentRecord {
  _id?: string;
  amount: number;
  method: ServicePaymentMethod;
  cardFee?: number;
  note?: string;
  paidAt: string;
  collectedBy?: string;
  collectedByName?: string;
}

export interface ServiceOrder {
  _id: string;
  orderCode: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  receivedAt: string;
  dueAt: string;
  returnedAt?: string | null;
  items: ServiceOrderItem[];
  rawSubtotal?: number;
  itemDiscountTotal?: number;
  subtotal?: number;
  billDiscountType?: ServiceDiscountType;
  billDiscountValue?: number;
  billDiscountAmount?: number;
  hasCardFee?: boolean;
  cardFeePercent?: number;
  cardFee?: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: ServicePaymentStatus;
  paymentMethod: ServicePaymentMethod;
  payments?: ServicePaymentRecord[];
  status: ServiceOrderStatus;
  isOverdue?: boolean;
  note?: string;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ServiceOrdersMeta {
  totalOrders: number;
  receivedCount: number;
  inProgressCount: number;
  readyCount: number;
  returnedCount: number;
  cancelledCount?: number;
  overdueCount: number;
  unpaidCount: number;
  totalRevenue: number;
  totalPaid: number;
  totalRemaining: number;
}

