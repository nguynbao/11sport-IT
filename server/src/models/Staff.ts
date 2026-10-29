import mongoose, { Schema, Document } from 'mongoose';

export type StaffRole = 'SALES' | 'WAREHOUSE' | 'ADMIN';
export type StaffStatus = 'ACTIVE' | 'LOCKED';

export interface IStaff extends Document {
  code: string;
  username: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  role: StaffRole;
  status: StaffStatus;
  createdAt: Date;
  updatedAt: Date;
}

const StaffSchema = new Schema<IStaff>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    role: { type: String, enum: ['SALES', 'WAREHOUSE', 'ADMIN'], required: true, default: 'SALES' },
    status: { type: String, enum: ['ACTIVE', 'LOCKED'], required: true, default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const StaffModel = mongoose.model<IStaff>('Staff', StaffSchema);
