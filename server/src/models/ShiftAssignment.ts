import mongoose, { Schema, Document } from 'mongoose';

export type ShiftType = 'SHIFT_1' | 'SHIFT_2' | 'BOTH' | 'OFF';

export interface IShiftAssignment extends Document {
  weekStart: string; // YYYY-MM-DD (Thứ Hai)
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 1 = Thứ 2, ... 7 = Chủ Nhật
  staffId: string;
  staffCode: string;
  staffName: string;
  shiftCode: ShiftType;
  preferenceShift?: ShiftType;
  isOffRequested?: boolean;
  assignedBy: 'AUTO' | 'HR';
  confirmedAt?: Date;
  seenByStaff?: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftAssignmentSchema = new Schema<IShiftAssignment>(
  {
    weekStart: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    dayOfWeek: { type: Number, required: true },
    staffId: { type: String, required: true, index: true },
    staffCode: { type: String, required: true },
    staffName: { type: String, required: true },
    shiftCode: { type: String, enum: ['SHIFT_1', 'SHIFT_2', 'BOTH', 'OFF'], required: true, default: 'SHIFT_1' },
    preferenceShift: { type: String, enum: ['SHIFT_1', 'SHIFT_2', 'BOTH', 'OFF'] },
    isOffRequested: { type: Boolean, default: false },
    assignedBy: { type: String, enum: ['AUTO', 'HR'], default: 'AUTO' },
    confirmedAt: { type: Date },
    seenByStaff: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

ShiftAssignmentSchema.index({ date: 1, staffId: 1 }, { unique: true });

export const ShiftAssignmentModel = mongoose.model<IShiftAssignment>(
  'ShiftAssignment',
  ShiftAssignmentSchema
);
