import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
      index: true,
    },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
          min: 1,
        },
        color: {
          type: Schema.Types.ObjectId,
          ref: "colors",
          default: null,
        },
        size: {
          type: Schema.Types.ObjectId,
          ref: "sizes",
          default: null,
        },
      },
    ],
  },
  { timestamps: true },
);

export type ICart = InferSchemaType<typeof cartSchema>;
export type CartItem = ICart["items"][number];

const Cart: Model<ICart> = mongoose.model<ICart>("carts", cartSchema);
export default Cart;