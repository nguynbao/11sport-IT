import mongoose, { Schema, Document } from 'mongoose';

export type ServiceTypeStatus = 'ACTIVE' | 'INACTIVE';

export interface IServiceType extends Document {
  code: string;
  name: string;
  defaultPrice: number;
  unit: string;
  description: string;
  status: ServiceTypeStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceTypeSchema = new Schema<IServiceType>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    defaultPrice: { type: Number, required: true, default: 0 },
    unit: { type: String, default: 'Cây', trim: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const ServiceTypeModel = mongoose.model<IServiceType>('ServiceType', ServiceTypeSchema);
