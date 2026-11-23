import mongoose, { Schema, Document } from 'mongoose';

export type BrandStatus = 'ACTIVE' | 'INACTIVE';

/**
 * Thương hiệu (R6): danh mục quản lý riêng, gắn với 1 hoặc nhiều Category.
 * Brand hệ thống `NN` (isSystem = true, không hãng) dùng được cho mọi Category.
 */
export interface IBrand extends Document {
  /** BrandCode 2–4 ký tự A-Z0-9, dùng trong mã sản phẩm */
  code: string;
  name: string;
  status: BrandStatus;
  /** Tên gọi khác để nhận diện khi import / chuyển đổi dữ liệu */
  aliases: string[];
  categoryIds: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], required: true, default: 'ACTIVE' },
    aliases: { type: [String], default: [] },
    categoryIds: { type: [String], default: [], index: true },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const BrandModel = mongoose.model<IBrand>('Brand', BrandSchema);
