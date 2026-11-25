import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomerAddress {
  id: string;
  label?: string;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  addressLine: string;
  isDefault?: boolean;
}

export interface ICustomer extends Document {
  phone?: string;
  email?: string;
  name: string;
  isVerified?: boolean;
  addresses?: ICustomerAddress[];
  totalOrders: number;
  totalSpent: number;
  lastOrderAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerAddressSchema = new Schema<ICustomerAddress>(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, default: '', trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    province: { type: String, default: '', trim: true },
    district: { type: String, default: '', trim: true },
    ward: { type: String, default: '', trim: true },
    addressLine: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const CustomerSchema = new Schema<ICustomer>(
  {
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true, default: 'Khách hàng' },
    isVerified: { type: Boolean, default: false },
    addresses: { type: [CustomerAddressSchema], default: [] },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderAt: { type: Date },
  },
  { timestamps: true }
);

CustomerSchema.index({ phone: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ email: 1 }, { unique: true, sparse: true });

export const CustomerModel = mongoose.model<ICustomer>('Customer', CustomerSchema);
