import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const bannerLinkSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["product", "category", "subCategory", "subSubCategory", "external"],
      required: [true, "Link type is required"],
    },
    target: { type: Schema.Types.ObjectId, default: null },
    externalUrl: { type: String, default: null },
    label: { type: String, default: null },
  },
  { _id: false },
);

const bannerSchema = new Schema(
  {
    image: { type: String, required: [true, "image is required"] },
    description: { type: String, required: [true, "description is required"] },
    link: { type: bannerLinkSchema, default: null },
    status: { type: Boolean, default: true },
    order: { type: Number, default: 0, min: 0, max: 1000 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

bannerSchema.index({ status: 1, deletedAt: 1, order: -1 });

export type IBanner = InferSchemaType<typeof bannerSchema>;

const BannerModel: Model<IBanner> = mongoose.model<IBanner>(
  "banners",
  bannerSchema,
);

export default BannerModel;