import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const auditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: [true, "Action is required"],
      enum: ["role_change", "user_delete", "user_create", "login", "logout"],
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: [true, "Admin ID is required"],
    },
    adminEmail: {
      type: String,
      required: [true, "Admin email is required"],
    },
    targetId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    targetEmail: {
      type: String,
      default: null,
    },
    details: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1 });

export type IAuditLog = InferSchemaType<typeof auditLogSchema>;

const auditLogModel: Model<IAuditLog> = mongoose.model<IAuditLog>("audit_logs", auditLogSchema);

export default auditLogModel;
