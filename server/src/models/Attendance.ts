import mongoose, { Schema, Document } from 'mongoose';

export type ShiftCode = 'SHIFT_1' | 'SHIFT_2' | 'BOTH';
export type AttendanceCheckInType = 'STANDARD' | 'WFH';
export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' | 'COMPLETED';
export type OvertimeStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IAttendance extends Document {
  staffId: string;
  staffCode: string;
  staffName: string;
  department: 'OFFICE' | 'SALES';
  date: string; // YYYY-MM-DD
  shiftCode: ShiftCode;
  checkInTime: Date;
  workStartTime: Date;
  checkOutTime?: Date;
  checkInType: AttendanceCheckInType;
  latitude?: number;
  longitude?: number;
  clientIp?: string;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyMinutes: number;
  lateCheckoutMinutes: number;
  lateCheckoutReason?: string;
  overtimeStatus: OvertimeStatus;
  overtimeApprovedMinutes: number;
  lunchPauseMinutes: number;
  totalWorkHours: number;
  notes?: string;
  adjustedBy?: string;
  adjustedByName?: string;
  adjustedAt?: Date;
  adjustReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    staffId: { type: String, required: true, index: true },
    staffCode: { type: String, required: true },
    staffName: { type: String, required: true },
    department: { type: String, enum: ['OFFICE', 'SALES'], required: true },
    date: { type: String, required: true, index: true },
    shiftCode: { type: String, enum: ['SHIFT_1', 'SHIFT_2', 'BOTH'], required: true, default: 'SHIFT_1' },
    checkInTime: { type: Date, required: true },
    workStartTime: { type: Date, required: true },
    checkOutTime: { type: Date },
    checkInType: { type: String, enum: ['STANDARD', 'WFH'], default: 'STANDARD' },
    latitude: { type: Number },
    longitude: { type: Number },
    clientIp: { type: String },
    status: {
      type: String,
      enum: ['ON_TIME', 'LATE', 'EARLY_LEAVE', 'COMPLETED'],
      default: 'ON_TIME',
    },
    lateMinutes: { type: Number, default: 0 },
    earlyMinutes: { type: Number, default: 0 },
    lateCheckoutMinutes: { type: Number, default: 0 },
    lateCheckoutReason: { type: String, default: '' },
    overtimeStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'NONE',
    },
    overtimeApprovedMinutes: { type: Number, default: 0 },
    lunchPauseMinutes: { type: Number, default: 0 },
    totalWorkHours: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    adjustedBy: { type: String },
    adjustedByName: { type: String },
    adjustedAt: { type: Date },
    adjustReason: { type: String, default: '' },
  },
  { timestamps: true }
);

AttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

export const AttendanceModel = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
