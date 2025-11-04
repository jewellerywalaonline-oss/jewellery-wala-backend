const mongoose = require("mongoose");

const subSubCategorySchema = new mongoose.Schema(
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
        type: mongoose.Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

subSubCategorySchema.index({ slug: 1 }, { unique: true });
subSubCategorySchema.index({ name: 1 }, { unique: true });

const SubSubCategory = mongoose.model("SubSubCategories", subSubCategorySchema);

module.exports = SubSubCategory;
