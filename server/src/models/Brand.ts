import mongoose, { Schema, Document } from 'mongoose';
import type { ISeoMeta } from './Product';

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
  /** v6.0: Thông tin hiển thị Storefront & SEO */
  slug?: string;
  logoUrl?: string;
  descriptionHtml?: string;
  isPublishedOnline?: boolean;
  sortOrder?: number;
  seo?: ISeoMeta;
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
    slug: { type: String, trim: true, lowercase: true },
    logoUrl: { type: String, default: '', trim: true },
    descriptionHtml: { type: String, default: '' },
    isPublishedOnline: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    seo: {
      type: {
        title: { type: String, default: '', trim: true },
        description: { type: String, default: '', trim: true },
        canonical: { type: String, default: '', trim: true },
        ogImage: { type: String, default: '', trim: true },
        noIndex: { type: Boolean, default: false },
      },
      _id: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

BrandSchema.index({ slug: 1 }, { unique: true, sparse: true });
BrandSchema.index({ isPublishedOnline: 1, status: 1, sortOrder: 1 });

export const BrandModel = mongoose.model<IBrand>('Brand', BrandSchema);
