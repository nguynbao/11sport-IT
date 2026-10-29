import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  phone: string;
  name: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderAt: { type: Date },
  },
  { timestamps: true }
);

export const CustomerModel = mongoose.model<ICustomer>('Customer', CustomerSchema);
