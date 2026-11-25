import mongoose, { Schema, Document } from 'mongoose';

export type OtpChannel = 'EMAIL' | 'SMS';

export interface ICustomerOtp extends Document {
  identifier: string;
  channel: OtpChannel;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerOtpSchema = new Schema<ICustomerOtp>(
  {
    identifier: { type: String, required: true, trim: true, lowercase: true },
    channel: { type: String, enum: ['EMAIL', 'SMS'], required: true, default: 'EMAIL' },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CustomerOtpSchema.index({ identifier: 1, createdAt: -1 });
CustomerOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CustomerOtpModel = mongoose.model<ICustomerOtp>('CustomerOtp', CustomerOtpSchema);
