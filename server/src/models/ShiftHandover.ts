import mongoose, { Schema, Document } from 'mongoose';

export interface IHandoverDiscrepancy {
  productCode: string;
  productName?: string;
  categoryName?: string;
  expected: number;
  actual: number;
  note?: string;
}

export type HandoverStatus = 'PENDING' | 'ACCEPTED' | 'DISCREPANCY_REPORTED' | 'STORE_CLOSED';

export interface IShiftHandover extends Document {
  date: string; // YYYY-MM-DD
  shiftCode: 'SHIFT_1' | 'SHIFT_2' | 'BOTH';
  fromStaffId: string;
  fromStaffName: string;
  toStaffId?: string;
  toStaffName?: string;
  handoverType: 'TANG_1';
  cashBalance: number;
  checkedCategories?: string[];
  totalCheckedProducts?: number;
  discrepancies: IHandoverDiscrepancy[];
  status: HandoverStatus;
  acceptedAt?: Date;
  notes?: string;
  confirmNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftHandoverSchema = new Schema<IShiftHandover>(
  {
    date: { type: String, required: true, index: true },
    shiftCode: { type: String, enum: ['SHIFT_1', 'SHIFT_2', 'BOTH'], required: true },
    fromStaffId: { type: String, required: true },
    fromStaffName: { type: String, required: true },
    toStaffId: { type: String },
    toStaffName: { type: String },
    handoverType: { type: String, default: 'TANG_1' },
    cashBalance: { type: Number, required: true, default: 0 },
    checkedCategories: { type: [String], default: [] },
    totalCheckedProducts: { type: Number, default: 0 },
    discrepancies: [
      {
        productCode: { type: String, required: true },
        productName: { type: String, default: '' },
        categoryName: { type: String, default: '' },
        expected: { type: Number, required: true },
        actual: { type: Number, required: true },
        note: { type: String, default: '' },
      },
    ],
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DISCREPANCY_REPORTED', 'STORE_CLOSED'],
      default: 'PENDING',
      index: true,
    },
    acceptedAt: { type: Date },
    notes: { type: String, default: '' },
    confirmNote: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ShiftHandoverModel = mongoose.model<IShiftHandover>(
  'ShiftHandover',
  ShiftHandoverSchema
);
