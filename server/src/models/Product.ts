import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  code: string;
  name: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  unit: string;
  sellingPrice: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, index: true },
    categoryCode: { type: String, default: '' },
    categoryName: { type: String, default: '' },
    unit: { type: String, required: true, default: 'Cái', trim: true },
    sellingPrice: { type: Number, required: true, default: 0, min: 0 },
    stock: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
