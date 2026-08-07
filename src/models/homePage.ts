import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const homeSectionSchema = new Schema({
  schemaVersion: { type: Number, default: 1 },
  type: {
    type: String,
    required: [true, "Section type is required"],
    enum: [
      "banner",
      "round-categories",
      "square-categories",
      "category-grid",
      "product-slider",
      "products-tab",
      "shop-by-price",
      "why-choose-us",
      "testimonial",
      "promo-banner",
      "video",
      "bento-grid",
      "custom",
    ],
  },
  config: { type: Schema.Types.Mixed, default: {} },
  order: { type: Number, default: 0 },
});

const homePageSchema = new Schema(
  {
    sections: { type: [homeSectionSchema], default: [] },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export type IHomePage = InferSchemaType<typeof homePageSchema>;

const HomePageModel: Model<IHomePage> = mongoose.model<IHomePage>(
  "homepages",
  homePageSchema,
);

export default HomePageModel;
