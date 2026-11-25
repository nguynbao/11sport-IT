import mongoose, { Schema, Document } from 'mongoose';
import type { ISeoMeta } from './Product';

export type OnlineStockMode = 'FLOOR_1' | 'ALL';

export interface IShowroomInfo {
  name: string;
  address: string;
  phone: string;
  hours?: string;
  mapUrl?: string;
  embedUrl?: string;
}

export interface IUspItem {
  icon: string;
  title: string;
  description: string;
}

export interface IWebSiteSetting extends Document {
  key: string;
  siteName: string;
  logoUrl?: string;
  faviconUrl?: string;
  brandColor?: string;
  topBarText?: string;
  hotline?: string;
  email?: string;
  zaloUrl?: string;
  messengerUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  showrooms: IShowroomInfo[];
  uspItems: IUspItem[];
  defaultShippingFee: number;
  freeShipThreshold: number;
  onlineStockMode: OnlineStockMode;
  ga4Id?: string;
  gtmId?: string;
  payosClientId?: string;
  payosApiKey?: string;
  payosChecksumKey?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  cloudinaryFolder?: string;
  webhookSecret?: string;
  revalidateSecret?: string;
  defaultSeo?: ISeoMeta;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShowroomSchema = new Schema<IShowroomInfo>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    hours: { type: String, default: '', trim: true },
    mapUrl: { type: String, default: '', trim: true },
    embedUrl: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const UspItemSchema = new Schema<IUspItem>(
  {
    icon: { type: String, default: '', trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const WebSiteSettingSchema = new Schema<IWebSiteSetting>(
  {
    key: { type: String, required: true, unique: true, default: 'DEFAULT', trim: true },
    siteName: { type: String, default: '11 Sport', trim: true },
    logoUrl: { type: String, default: '', trim: true },
    faviconUrl: { type: String, default: '', trim: true },
    brandColor: { type: String, default: '#0D9488', trim: true },
    topBarText: { type: String, default: '', trim: true },
    hotline: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    zaloUrl: { type: String, default: '', trim: true },
    messengerUrl: { type: String, default: '', trim: true },
    facebookUrl: { type: String, default: '', trim: true },
    tiktokUrl: { type: String, default: '', trim: true },
    youtubeUrl: { type: String, default: '', trim: true },
    showrooms: { type: [ShowroomSchema], default: [] },
    uspItems: { type: [UspItemSchema], default: [] },
    defaultShippingFee: { type: Number, default: 30000, min: 0 },
    freeShipThreshold: { type: Number, default: 500000, min: 0 },
    onlineStockMode: {
      type: String,
      enum: ['FLOOR_1', 'ALL'],
      default: 'FLOOR_1',
    },
    ga4Id: { type: String, default: '', trim: true },
    gtmId: { type: String, default: '', trim: true },
    payosClientId: { type: String, default: '', trim: true },
    payosApiKey: { type: String, default: '', trim: true },
    payosChecksumKey: { type: String, default: '', trim: true },
    cloudinaryCloudName: { type: String, default: '', trim: true },
    cloudinaryApiKey: { type: String, default: '', trim: true },
    cloudinaryApiSecret: { type: String, default: '', trim: true },
    cloudinaryFolder: { type: String, default: '11sport-web', trim: true },
    webhookSecret: { type: String, default: '', trim: true },
    revalidateSecret: { type: String, default: '', trim: true },
    defaultSeo: {
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

export const WebSiteSettingModel = mongoose.model<IWebSiteSetting>(
  'WebSiteSetting',
  WebSiteSettingSchema
);
