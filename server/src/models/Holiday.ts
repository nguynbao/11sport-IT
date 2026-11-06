import mongoose, { Schema, Document } from 'mongoose';

export interface IHoliday extends Document {
  date: string; // YYYY-MM-DD
  name: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    date: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

export const HolidayModel = mongoose.model<IHoliday>('Holiday', HolidaySchema);
