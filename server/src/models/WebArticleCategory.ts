import mongoose, { Schema, Document } from 'mongoose';
import type { ISeoMeta } from './Product';

export interface IWebArticleCategory extends Document {
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  seo?: ISeoMeta;
  createdAt: Date;
  updatedAt: Date;
}

const WebArticleCategorySchema = new Schema<IWebArticleCategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: '', trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
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

WebArticleCategorySchema.index({ slug: 1 }, { unique: true, sparse: true });
WebArticleCategorySchema.index({ isActive: 1, sortOrder: 1 });

export const WebArticleCategoryModel = mongoose.model<IWebArticleCategory>(
  'WebArticleCategory',
  WebArticleCategorySchema
);
