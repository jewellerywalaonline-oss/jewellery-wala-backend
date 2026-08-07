import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const aiUsageSchema = new Schema(
  {
    date: {
      type: String,
      required: [true, "Date is required (YYYY-MM-DD)"],
      unique: true,
    },
    tokensUsed: { type: Number, default: 0 },
    requestsCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type IAiUsage = InferSchemaType<typeof aiUsageSchema>;

const AiUsageModel: Model<IAiUsage> = mongoose.model<IAiUsage>(
  "aiusages",
  aiUsageSchema,
);

export default AiUsageModel;
