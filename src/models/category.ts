import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    image: {
      type: String,
      default: "",
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
      match: /^[0-9]+$/,
    },
    status: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      trim: true,
    },
    bannerId: {
      type: Schema.Types.ObjectId,
      ref: "banners",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

categorySchema.index({ name: 1 }, { unique: true });
categorySchema.index({ deletedAt: 1, status: 1, order: -1 });
categorySchema.index({ slug: 1, status: 1, deletedAt: 1 });

export type ICategory = InferSchemaType<typeof categorySchema>;

const Category: Model<ICategory> = mongoose.model<ICategory>(
  "Categories",
  categorySchema,
);

export default Category;