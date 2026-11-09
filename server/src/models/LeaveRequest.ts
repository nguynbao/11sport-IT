import mongoose, { Schema, Document } from 'mongoose';

export type LeaveRequestType = 'WFH' | 'OFF' | 'LATE' | 'EARLY' | 'PAID_LEAVE';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ILeaveRequest extends Document {
  staffId: string;
  staffCode: string;
  staffName: string;
  department: 'OFFICE' | 'SALES';
  type: LeaveRequestType;
  date: string; // YYYY-MM-DD
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
    type: { type: String, enum: ['WFH', 'OFF', 'LATE', 'EARLY', 'PAID_LEAVE'], required: true },
    date: { type: String, required: true, index: true },
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
