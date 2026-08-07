import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const aiResponseSchema = new Schema(
  {
    prompt: { type: String, required: [true, "Prompt is required"] },
    response: { type: String, required: [true, "Response is required"] },
    messages: { type: Schema.Types.Mixed, default: null },
    page: {
      type: String,
      required: [true, "Page context is required"],
      enum: ["product-description", "faq", "banner", "seo", "other", "ai-agent"],
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: [true, "Admin ID is required"],
    },
    /**
     * Client-generated conversation ID (from @ai-sdk/react generateId()).
     * This is NOT the MongoDB _id — it's a random string like "rnRd4owKpsc8KAWA"
     * that the client uses to correlate successive chat turns to the same
     * conversation. Stored here so the server can look up by it on updates.
     */
    conversationId: { type: String, default: null },
  },
  { timestamps: true },
);

aiResponseSchema.index({ createdAt: -1 });
aiResponseSchema.index({ page: 1, createdAt: -1 });
aiResponseSchema.index({ conversationId: 1 });

export type IAiResponse = InferSchemaType<typeof aiResponseSchema>;

const AiResponseModel: Model<IAiResponse> = mongoose.model<IAiResponse>(
  "airesponses",
  aiResponseSchema,
);

export default AiResponseModel;
