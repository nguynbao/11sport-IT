import mongoose, { Schema, Document } from 'mongoose';

export type WebHomeSectionType =
  | 'HERO'
  | 'CATEGORY_GRID'
  | 'CATEGORY_CAROUSEL'
  | 'FLASH_SALE'
  | 'USP'
  | 'BRANDS'
  | 'BLOG'
  | 'CUSTOM_BANNER';

export interface IWebHomeSection extends Document {
  type: WebHomeSectionType;
  title: string;
  subtitle?: string;
  viewAllUrl?: string;
  configJson?: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebHomeSectionSchema = new Schema<IWebHomeSection>(
  {
    type: {
      type: String,
      enum: [
        'HERO',
        'CATEGORY_GRID',
        'CATEGORY_CAROUSEL',
        'FLASH_SALE',
        'USP',
        'BRANDS',
        'BLOG',
        'CUSTOM_BANNER',
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '', trim: true },
    viewAllUrl: { type: String, default: '', trim: true },
    configJson: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

WebHomeSectionSchema.index({ isActive: 1, sortOrder: 1 });

export const WebHomeSectionModel = mongoose.model<IWebHomeSection>(
  'WebHomeSection',
  WebHomeSectionSchema
);
