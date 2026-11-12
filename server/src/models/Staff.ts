import mongoose, { Schema, Document } from 'mongoose';

export type StaffRole = 'SALES' | 'WAREHOUSE' | 'ADMIN' | 'HR' | 'ACCOUNTANT' | 'MARKETING';
export type StaffDepartment = 'OFFICE' | 'SALES';
/** INTERN = Thực tập, PROBATION = Thử việc, FULLTIME = Chính thức (PARTTIME: giá trị cũ, chỉ đọc) */
export type ContractType = 'INTERN' | 'PROBATION' | 'FULLTIME' | 'PARTTIME';
export type StaffStatus = 'ACTIVE' | 'LOCKED';

export interface IStaff extends Document {
  code: string;
  username: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  email?: string;
  companyEmail?: string;
  dateOfBirth?: Date;
  gender?: string;
  nationality?: string;
  citizenId?: string;
  citizenIssueDate?: Date;
  citizenIssuePlace?: string;
  address?: string;
  permanentAddress?: string;
  currentAddress?: string;
  school?: string;
  major?: string;
  positionTitle?: string;
  bankAccount?: string;
  role: StaffRole;
  department: StaffDepartment;
  contractType?: ContractType;
  contractStartDate?: Date;
  contractEndDate?: Date;
  internContractNumber?: string;
  probationContractNumber?: string;
  officialContractNumber?: string;
  probationStartDate?: Date;
  probationMonths?: number;
  fulltimeStartDate?: Date;
  contractFileUrl?: string;
  contractFileName?: string;
  bhxhStartDate?: Date;
  bhxhEndDate?: Date;
  recordedLeaveDays?: number;
  baseSalary?: number;
  allowance?: number;
  bonus?: number;
  insurance?: number;
  mustChangePassword?: boolean;
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
    companyEmail: { type: String, default: '', trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, default: '', trim: true },
    nationality: { type: String, default: '', trim: true },
    citizenId: { type: String, default: '', trim: true },
    citizenIssueDate: { type: Date },
    citizenIssuePlace: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    permanentAddress: { type: String, default: '', trim: true },
    currentAddress: { type: String, default: '', trim: true },
    school: { type: String, default: '', trim: true },
    major: { type: String, default: '', trim: true },
    positionTitle: { type: String, default: '', trim: true },
    bankAccount: { type: String, default: '', trim: true },
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
      enum: ['INTERN', 'PROBATION', 'FULLTIME', 'PARTTIME'],
      default: 'PROBATION',
    },
    contractStartDate: { type: Date },
    contractEndDate: { type: Date },
    internContractNumber: { type: String, default: '', trim: true },
    probationContractNumber: { type: String, default: '', trim: true },
    officialContractNumber: { type: String, default: '', trim: true },
    probationStartDate: { type: Date },
    probationMonths: { type: Number, default: 0, min: 0, max: 2 },
    fulltimeStartDate: { type: Date },
    contractFileUrl: { type: String, default: '' },
    contractFileName: { type: String, default: '', trim: true },
    bhxhStartDate: { type: Date },
    bhxhEndDate: { type: Date },
    recordedLeaveDays: { type: Number, default: 0, min: 0 },
    baseSalary: { type: Number, default: 0, min: 0 },
    allowance: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    insurance: { type: Number, default: 0, min: 0 },
    mustChangePassword: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'LOCKED'], required: true, default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const StaffModel = mongoose.model<IStaff>('Staff', StaffSchema);
