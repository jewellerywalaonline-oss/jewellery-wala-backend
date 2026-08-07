import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const whyChooseUsSchema = new Schema(
  {
    title: { type: String, required: [true, "Title is required"] },
    description: { type: String, required: [true, "Description is required"] },
    image: { type: String, required: [true, "Image is required"] },
    status: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

whyChooseUsSchema.index({ deletedAt: 1, status: 1 });

export type IWhyChooseUs = InferSchemaType<typeof whyChooseUsSchema>;

const WhyChooseUs: Model<IWhyChooseUs> = mongoose.model<IWhyChooseUs>(
  "WhyChooseUs",
  whyChooseUsSchema,
);

export default WhyChooseUs;