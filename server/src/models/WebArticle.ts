import mongoose, { Schema, Document } from 'mongoose';
import type { ISeoMeta } from './Product';

export type WebArticleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED';

export interface IWebArticle extends Document {
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml: string;
  thumbnailUrl?: string;
  categoryId?: string;
  tags: string[];
  relatedProductIds?: string[];
  status: WebArticleStatus;
  publishedAt?: Date | null;
  authorId?: string;
  authorName?: string;
  approvedBy?: string;
  seo?: ISeoMeta;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebArticleSchema = new Schema<IWebArticle>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    excerpt: { type: String, default: '', trim: true },
    contentHtml: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '', trim: true },
    categoryId: { type: String, default: '' },
    tags: { type: [String], default: [] },
    relatedProductIds: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED'],
      required: true,
      default: 'DRAFT',
    },
    publishedAt: { type: Date, default: null },
    authorId: { type: String, default: '' },
    authorName: { type: String, default: '', trim: true },
    approvedBy: { type: String, default: '' },
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
    viewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

WebArticleSchema.index({ slug: 1 }, { unique: true, sparse: true });
WebArticleSchema.index({ status: 1, publishedAt: -1 });
WebArticleSchema.index({ categoryId: 1, status: 1, publishedAt: -1 });
WebArticleSchema.index({ tags: 1 });

export const WebArticleModel = mongoose.model<IWebArticle>('WebArticle', WebArticleSchema);
