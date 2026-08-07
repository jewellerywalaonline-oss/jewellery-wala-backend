import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const subCategorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Sub-category name is required"],
      trim: true,
      maxlength: [100, "Sub-category name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    category: [
      {
        type: Schema.Types.ObjectId,
        ref: "Categories",
        required: [true, "Category reference is required"],
      },
    ],
    image: {
      type: String,
      required: [true, "Image URL is required"],
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
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

subCategorySchema.index({ name: 1 }, { unique: true });
subCategorySchema.index({ deletedAt: 1, status: 1, order: -1 });
subCategorySchema.index({ slug: 1, status: 1, deletedAt: 1 });
subCategorySchema.index({ category: 1, status: 1, deletedAt: 1 });

export type ISubCategory = InferSchemaType<typeof subCategorySchema>;

const SubCategory: Model<ISubCategory> = mongoose.model<ISubCategory>(
  "SubCategories",
  subCategorySchema,
);

export default SubCategory;