import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const testimonialSchema = new Schema(
  {
    title: { type: String, required: [true, "Title is required"] },
    description: { type: String, required: [true, "Description is required"] },
    rating: { type: Number, required: [true, "Enter A Valid Rating"] },
    image: { type: String, required: [true, "Image is required"] },
    address: { type: String, required: [true, "A Valid Address Is Required"] },
    status: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

testimonialSchema.index({ deletedAt: 1, status: 1 });

export type ITestimonial = InferSchemaType<typeof testimonialSchema>;

const Testimonial: Model<ITestimonial> = mongoose.model<ITestimonial>(
  "Testimonials",
  testimonialSchema,
);

export default Testimonial;