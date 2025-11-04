const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    comment: { type: String, required: [true, "Comment is required"] },
    rating: { type: Number, required: [true, "Rating is required"] },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Product ID is required"],
      ref: "Products",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "User ID is required"],
      ref: "users",
    },
    status: {
      type: Boolean,
      default: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reviews", reviewSchema);
