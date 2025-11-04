const mongoose = require("mongoose");

const subCategorySchema = new mongoose.Schema(
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
        type: mongoose.Schema.Types.ObjectId,
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
  
  },

  {
    timestamps: true,
  }
);

subCategorySchema.index({ slug: 1 }, { unique: true });
subCategorySchema.index({ name: 1 }, { unique: true });

const SubCategory = mongoose.model("SubCategories", subCategorySchema);

module.exports = SubCategory;
