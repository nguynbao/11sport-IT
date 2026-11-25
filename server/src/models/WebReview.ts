import mongoose, { Schema, Document } from 'mongoose';

export type WebReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IWebReview extends Document {
  productId: string;
  customerId?: string;
  customerName: string;
  orderId?: string;
  rating: number;
  comment: string;
  images: string[];
  isVerifiedPurchase: boolean;
  status: WebReviewStatus;
  adminReply?: string;
  moderatedBy?: string;
  moderatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WebReviewSchema = new Schema<IWebReview>(
  {
    productId: { type: String, required: true, trim: true },
    customerId: { type: String, default: '', trim: true },
    customerName: { type: String, required: true, trim: true },
    orderId: { type: String, default: '', trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true },
    images: { type: [String], default: [] },
    isVerifiedPurchase: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      required: true,
      default: 'PENDING',
    },
    adminReply: { type: String, default: '', trim: true },
    moderatedBy: { type: String, default: '' },
    moderatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

WebReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
WebReviewSchema.index({ status: 1, createdAt: -1 });
WebReviewSchema.index({ customerId: 1, productId: 1 });

export const WebReviewModel = mongoose.model<IWebReview>('WebReview', WebReviewSchema);
