import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const subSubCategorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Sub-sub-category name is required"],
      trim: true,
      maxlength: [100, "Sub-sub-category name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    subCategory: [
      {
        type: Schema.Types.ObjectId,
        ref: "SubCategories",
        required: [true, "Sub-category reference is required"],
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

subSubCategorySchema.index({ name: 1 }, { unique: true });
subSubCategorySchema.index({ deletedAt: 1, status: 1, order: -1 });
subSubCategorySchema.index({ slug: 1, status: 1, deletedAt: 1 });
subSubCategorySchema.index({ subCategory: 1, status: 1, deletedAt: 1 });

export type ISubSubCategory = InferSchemaType<typeof subSubCategorySchema>;

const SubSubCategory: Model<ISubSubCategory> = mongoose.model<ISubSubCategory>(
  "SubSubCategories",
  subSubCategorySchema,
);

export default SubSubCategory;