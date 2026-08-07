import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const wishlistSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
    },
    products: [
      {
        type: Schema.Types.ObjectId,
        ref: "products",
      },
    ],
  },
  { timestamps: true },
);

export type IWishlist = InferSchemaType<typeof wishlistSchema>;

const Wishlist: Model<IWishlist> = mongoose.model<IWishlist>(
  "Wishlist",
  wishlistSchema,
);

export default Wishlist;