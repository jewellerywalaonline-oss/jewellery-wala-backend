import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const jobSchema = new Schema(
  {
    type: {
      type: String,
      required: [true, "Job type is required"],
      enum: ["send-email", "update-profile", "update-rating"],
    },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    retries: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    error: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

jobSchema.index({ status: 1, createdAt: 1 });

export type IJob = InferSchemaType<typeof jobSchema>;

const JobModel: Model<IJob> = mongoose.model<IJob>("jobs", jobSchema);

export default JobModel;
