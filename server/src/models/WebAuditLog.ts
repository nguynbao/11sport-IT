import mongoose, { Schema, Document } from 'mongoose';

export interface IWebAuditLog extends Document {
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  diffSummary?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const WebAuditLogSchema = new Schema<IWebAuditLog>(
  {
    actorId: { type: String, required: true, trim: true },
    actorName: { type: String, required: true, trim: true },
    actorRole: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: String, default: '', trim: true },
    diffSummary: { type: String, default: '', trim: true },
    metadata: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

WebAuditLogSchema.index({ createdAt: -1 });
WebAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
WebAuditLogSchema.index({ actorId: 1, createdAt: -1 });

export const WebAuditLogModel = mongoose.model<IWebAuditLog>('WebAuditLog', WebAuditLogSchema);
