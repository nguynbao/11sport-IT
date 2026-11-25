import mongoose, { Schema, Document } from 'mongoose';

export type WebBannerPosition = 'HERO' | 'INLINE_1' | 'INLINE_2' | 'SIDEBAR';
export type WebBannerStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface IWebBanner extends Document {
  title: string;
  position: WebBannerPosition;
  desktopImageUrl: string;
  mobileImageUrl: string;
  linkUrl?: string;
  altText?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  status: WebBannerStatus;
  sortOrder: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebBannerSchema = new Schema<IWebBanner>(
  {
    title: { type: String, required: true, trim: true },
    position: {
      type: String,
      enum: ['HERO', 'INLINE_1', 'INLINE_2', 'SIDEBAR'],
      required: true,
      default: 'HERO',
    },
    desktopImageUrl: { type: String, required: true, trim: true },
    mobileImageUrl: { type: String, required: true, trim: true },
    linkUrl: { type: String, default: '', trim: true },
    altText: { type: String, default: '', trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'INACTIVE'],
      required: true,
      default: 'DRAFT',
    },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

WebBannerSchema.index({ status: 1, position: 1, sortOrder: 1 });
WebBannerSchema.index({ startDate: 1, endDate: 1 });

export const WebBannerModel = mongoose.model<IWebBanner>('WebBanner', WebBannerSchema);
