const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "products",
      },
    ],
  },
  { timestamps: true }
);

wishlistSchema.index({ user: 1 });

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
module.exports = Wishlist;
