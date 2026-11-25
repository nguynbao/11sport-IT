import mongoose, { Schema, Document } from 'mongoose';

export type WebRedirectStatusCode = 301 | 302;

export interface IWebRedirect extends Document {
  fromPath: string;
  toPath: string;
  statusCode: WebRedirectStatusCode;
  isActive: boolean;
  note?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebRedirectSchema = new Schema<IWebRedirect>(
  {
    fromPath: { type: String, required: true, trim: true, lowercase: true },
    toPath: { type: String, required: true, trim: true },
    statusCode: { type: Number, enum: [301, 302], required: true, default: 301 },
    isActive: { type: Boolean, default: true },
    note: { type: String, default: '', trim: true },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

WebRedirectSchema.index({ fromPath: 1 }, { unique: true });
WebRedirectSchema.index({ isActive: 1 });

export const WebRedirectModel = mongoose.model<IWebRedirect>('WebRedirect', WebRedirectSchema);
