import mongoose, { Schema, Document } from 'mongoose';

export type ServiceOrderStatus = 'RECEIVED' | 'IN_PROGRESS' | 'READY' | 'RETURNED' | 'CANCELLED';
export type ServicePaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type ServicePaymentMethod = 'CASH' | 'BANKING' | 'CARD';

export interface IServiceOrderItem {
  serviceTypeId: string;
  serviceCode: string;
  serviceName: string;
  unit: string;
  defaultPrice: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  itemNote: string;
}

export interface IServicePaymentRecord {
  _id?: string;
  amount: number;
  method: ServicePaymentMethod;
  note?: string;
  paidAt: Date;
  collectedBy: string;
  collectedByName: string;
}

export interface IServiceOrder extends Document {
  orderCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  receivedAt: Date;
  dueAt: Date;
  returnedAt?: Date | null;
  items: IServiceOrderItem[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: ServicePaymentStatus;
  paymentMethod: ServicePaymentMethod;
  payments: IServicePaymentRecord[];
  status: ServiceOrderStatus;
  note: string;
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceOrderItemSchema = new Schema<IServiceOrderItem>(
  {
    serviceTypeId: { type: String, default: '' },
    serviceCode: { type: String, required: true },
    serviceName: { type: String, required: true },
    unit: { type: String, default: 'Cây' },
    defaultPrice: { type: Number, default: 0 },
    unitPrice: { type: Number, required: true, default: 0 },
    quantity: { type: Number, required: true, default: 1 },
    lineTotal: { type: Number, required: true, default: 0 },
    itemNote: { type: String, default: '' },
  },
  { _id: false }
);

const ServicePaymentRecordSchema = new Schema<IServicePaymentRecord>(
  {
    _id: { type: String, default: '' },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['CASH', 'BANKING', 'CARD'], default: 'CASH' },
    note: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
    collectedBy: { type: String, default: '' },
    collectedByName: { type: String, default: '' },
  },
  { _id: false }
);

const ServiceOrderSchema = new Schema<IServiceOrder>(
  {
    orderCode: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, default: '' },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true, index: true },
    receivedAt: { type: Date, required: true, default: Date.now },
    dueAt: { type: Date, required: true, index: true },
    returnedAt: { type: Date, default: null },
    items: { type: [ServiceOrderItemSchema], default: [] },
    totalAmount: { type: Number, required: true, default: 0 },
    paidAmount: { type: Number, required: true, default: 0 },
    remainingAmount: { type: Number, required: true, default: 0, index: true },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PARTIAL', 'PAID'],
      default: 'UNPAID',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'BANKING', 'CARD'],
      default: 'CASH',
    },
    payments: { type: [ServicePaymentRecordSchema], default: [] },
    status: {
      type: String,
      enum: ['RECEIVED', 'IN_PROGRESS', 'READY', 'RETURNED', 'CANCELLED'],
      default: 'RECEIVED',
      index: true,
    },
    note: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    createdByName: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
    updatedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ServiceOrderModel = mongoose.model<IServiceOrder>('ServiceOrder', ServiceOrderSchema);
