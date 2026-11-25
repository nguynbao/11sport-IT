import mongoose, { Schema, Document } from 'mongoose';

export interface IWebMenu extends Document {
  label: string;
  url: string;
  parentId?: string | null;
  icon?: string;
  badge?: string;
  sortOrder: number;
  isActive: boolean;
  openInNewTab?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WebMenuSchema = new Schema<IWebMenu>(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    parentId: { type: String, default: null },
    icon: { type: String, default: '', trim: true },
    badge: { type: String, default: '', trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    openInNewTab: { type: Boolean, default: false },
  },
  { timestamps: true }
);

WebMenuSchema.index({ isActive: 1, parentId: 1, sortOrder: 1 });

export const WebMenuModel = mongoose.model<IWebMenu>('WebMenu', WebMenuSchema);
