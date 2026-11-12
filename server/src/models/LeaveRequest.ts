import mongoose, { Schema, Document } from 'mongoose';

export type LeaveRequestType = 'WFH' | 'OFF' | 'LATE' | 'EARLY' | 'PAID_LEAVE' | 'CHANGE_OFF';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ILeaveRequest extends Document {
  staffId: string;
  staffCode: string;
  staffName: string;
  department: 'OFFICE' | 'SALES';
  type: LeaveRequestType;
  date: string; // YYYY-MM-DD (với CHANGE_OFF: ngày off mới muốn chuyển sang)
  fromDate?: string; // YYYY-MM-DD (với CHANGE_OFF: ngày off ban đầu muốn đổi)
  sourceLeaveId?: string; // ID đơn OFF / PAID_LEAVE gốc tại ngày fromDate (nếu có)
  sourceOffType?: 'OFF' | 'PAID_LEAVE'; // Loại nghỉ của ngày gốc
  reason: string;
  status: LeaveRequestStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveRequestSchema = new Schema<ILeaveRequest>(
  {
    staffId: { type: String, required: true, index: true },
    staffCode: { type: String, required: true },
    staffName: { type: String, required: true },
    department: { type: String, enum: ['OFFICE', 'SALES'], required: true },
    type: {
      type: String,
      enum: ['WFH', 'OFF', 'LATE', 'EARLY', 'PAID_LEAVE', 'CHANGE_OFF'],
      required: true,
    },
    date: { type: String, required: true, index: true },
    fromDate: { type: String },
    sourceLeaveId: { type: String },
    sourceOffType: { type: String, enum: ['OFF', 'PAID_LEAVE'] },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: '' },
  },
  { timestamps: true }
);

export const LeaveRequestModel = mongoose.model<ILeaveRequest>('LeaveRequest', LeaveRequestSchema);
