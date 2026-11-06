import mongoose, { Schema, Document } from 'mongoose';

export interface IHandoverDiscrepancy {
  productCode: string;
  expected: number;
  actual: number;
  note?: string;
}

export type HandoverStatus = 'PENDING' | 'ACCEPTED' | 'STORE_CLOSED';

export interface IShiftHandover extends Document {
  date: string; // YYYY-MM-DD
  shiftCode: 'SHIFT_1' | 'SHIFT_2';
  fromStaffId: string;
  fromStaffName: string;
  toStaffId?: string;
  toStaffName?: string;
  handoverType: 'TANG_1';
  cashBalance: number;
  discrepancies: IHandoverDiscrepancy[];
  status: HandoverStatus;
  acceptedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftHandoverSchema = new Schema<IShiftHandover>(
  {
    date: { type: String, required: true, index: true },
    shiftCode: { type: String, enum: ['SHIFT_1', 'SHIFT_2'], required: true },
    fromStaffId: { type: String, required: true },
    fromStaffName: { type: String, required: true },
    toStaffId: { type: String },
    toStaffName: { type: String },
    handoverType: { type: String, default: 'TANG_1' },
    cashBalance: { type: Number, required: true, default: 0 },
    discrepancies: [
      {
        productCode: { type: String, required: true },
        expected: { type: Number, required: true },
        actual: { type: Number, required: true },
        note: { type: String, default: '' },
      },
    ],
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'STORE_CLOSED'],
      default: 'PENDING',
      index: true,
    },
    acceptedAt: { type: Date },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ShiftHandoverModel = mongoose.model<IShiftHandover>(
  'ShiftHandover',
  ShiftHandoverSchema
);
