import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const aiCacheSchema = new Schema(
  {
    promptHash: {
      type: String,
      required: [true, "Prompt hash is required"],
      unique: true,
    },
    response: { type: String, required: [true, "Response is required"] },
    model: { type: String, required: [true, "Model name is required"] },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true },
);

export type IAiCache = InferSchemaType<typeof aiCacheSchema>;

const AiCacheModel: Model<IAiCache> = mongoose.model<IAiCache>(
  "aicaches",
  aiCacheSchema,
);

export default AiCacheModel;
