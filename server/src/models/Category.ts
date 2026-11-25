import mongoose, { Schema, Document } from 'mongoose';
import type { ISeoMeta } from './Product';

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface ICategory extends Document {
  code: string;
  /** CateCode 1–3 ký tự dùng làm phần đầu mã sản phẩm (v5.0) */
  skuCode?: string;
  name: string;
  status: CategoryStatus;
  /** v6.0: Thông tin hiển thị Storefront & SEO */
  slug?: string;
  imageUrl?: string;
  descriptionHtml?: string;
  isPublishedOnline?: boolean;
  sortOrder?: number;
  seo?: ISeoMeta;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    skuCode: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], required: true, default: 'ACTIVE' },
    slug: { type: String, trim: true, lowercase: true },
    imageUrl: { type: String, default: '', trim: true },
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

CategorySchema.index({ slug: 1 }, { unique: true, sparse: true });
CategorySchema.index({ isPublishedOnline: 1, status: 1, sortOrder: 1 });

export const CategoryModel = mongoose.model<ICategory>('Category', CategorySchema);
