const mongoose = require("mongoose");

const coupenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Coupon Name is required"],
    },
    description: {
      type: String,
      default: "",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: ["public", "private"],
      default: function () {
        return this.userId ? "private" : "public";
      },
    },

    code: {
      type: String,
      required: [true, "Coupon Code is required"],
    },
    discountPercentage: {
      type: Number,
      required: [true, "Coupon Discount is required"],
      min: [0, "Discount should be greater than 0"],
      max: [100, "Discount should be less than 100"],
    },
    minAmount: {
      type: Number,
      required: [true, "Minimum amount is required"],
      min: [0, "Minimum amount should be greater than 0"],
    },
    maxAmount: {
      type: Number,
      required: [true, "Maximum amount is required"],
      min: [0, "Maximum amount should be greater than 0"],
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupens", coupenSchema);

coupenSchema.index({ code: 1 });
coupenSchema.index({ userId: 1 });
