import mongoose, { Schema, Document } from 'mongoose';

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface ICategory extends Document {
  code: string;
  /** CateCode 1–3 ký tự dùng làm phần đầu mã sản phẩm (v5.0) */
  skuCode?: string;
  name: string;
  status: CategoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    skuCode: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], required: true, default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const CategoryModel = mongoose.model<ICategory>('Category', CategorySchema);
