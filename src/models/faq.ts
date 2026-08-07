import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const faqSchema = new Schema(
  {
    question: {
      type: String,
      required: [true, "Please Enter A Question"],
      validate: {
        validator: async function (
          this: { constructor: Model<{ question: string }> },
          question: string,
        ) {
          const existing = await this.constructor.findOne({ question });
          return !existing;
        },
        message: "Question already exists",
      },
    },
    answer: { type: String, required: [true, "Please Enter A Answer"] },
    status: { type: Boolean, default: true },
    order: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
      match: /^[0-9]+$/,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

faqSchema.index({ deletedAt: 1, status: 1, order: -1 });

export type IFaq = InferSchemaType<typeof faqSchema>;

const FaqModel: Model<IFaq> = mongoose.model<IFaq>("faqs", faqSchema);
export default FaqModel;