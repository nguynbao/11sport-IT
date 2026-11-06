import mongoose, { Schema, Document } from 'mongoose';

export type StaffRole = 'SALES' | 'WAREHOUSE' | 'ADMIN' | 'HR' | 'ACCOUNTANT' | 'MARKETING';
export type StaffDepartment = 'OFFICE' | 'SALES';
export type ContractType = 'FULLTIME' | 'PARTTIME' | 'PROBATION';
export type StaffStatus = 'ACTIVE' | 'LOCKED';

export interface IStaff extends Document {
  code: string;
  username: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  email?: string;
  citizenId?: string;
  address?: string;
  role: StaffRole;
  department: StaffDepartment;
  contractType?: ContractType;
  contractStartDate?: Date;
  contractEndDate?: Date;
  contractFileUrl?: string;
  contractFileName?: string;
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
    email: { type: String, default: '', trim: true },
    citizenId: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    role: {
      type: String,
      enum: ['SALES', 'WAREHOUSE', 'ADMIN', 'HR', 'ACCOUNTANT', 'MARKETING'],
      required: true,
      default: 'SALES',
    },
    department: {
      type: String,
      enum: ['OFFICE', 'SALES'],
      required: true,
      default: 'SALES',
    },
    contractType: {
      type: String,
      enum: ['FULLTIME', 'PARTTIME', 'PROBATION'],
      default: 'FULLTIME',
    },
    contractStartDate: { type: Date },
    contractEndDate: { type: Date },
    contractFileUrl: { type: String, default: '' },
    contractFileName: { type: String, default: '', trim: true },
    status: { type: String, enum: ['ACTIVE', 'LOCKED'], required: true, default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const StaffModel = mongoose.model<IStaff>('Staff', StaffSchema);
