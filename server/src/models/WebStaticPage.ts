import mongoose, { Schema, Document } from 'mongoose';
import type { ISeoMeta } from './Product';

export type WebStaticPageStatus = 'DRAFT' | 'PUBLISHED';

export interface IWebStaticPage extends Document {
  title: string;
  slug: string;
  contentHtml: string;
  status: WebStaticPageStatus;
  seo?: ISeoMeta;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebStaticPageSchema = new Schema<IWebStaticPage>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    contentHtml: { type: String, default: '' },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED'],
      required: true,
      default: 'DRAFT',
    },
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
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

WebStaticPageSchema.index({ slug: 1 }, { unique: true, sparse: true });
WebStaticPageSchema.index({ status: 1 });

export const WebStaticPageModel = mongoose.model<IWebStaticPage>(
  'WebStaticPage',
  WebStaticPageSchema
);
