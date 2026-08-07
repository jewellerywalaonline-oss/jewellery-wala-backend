import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const productFaqEntrySchema = new Schema(
  {
    question: { type: String, required: [true, "Question is required"] },
    answer: { type: String, required: [true, "Answer is required"] },
    order: { type: Number, default: 0, min: 0, max: 1000 },
  },
  { _id: false },
);

const productFaqSchema = new Schema(
  {
    products: {
      type: [{ type: Schema.Types.ObjectId, ref: "products" }],
      default: [],
    },
    entries: {
      type: [productFaqEntrySchema],
      default: [],
      validate: {
        validator: (v: unknown[]) => v.length > 0,
        message: "At least one FAQ entry is required",
      },
    },
    status: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

productFaqSchema.index({ products: 1 });

export type IProductFaq = InferSchemaType<typeof productFaqSchema>;

const ProductFaqModel: Model<IProductFaq> = mongoose.model<IProductFaq>(
  "productfaqs",
  productFaqSchema,
);

export default ProductFaqModel;
