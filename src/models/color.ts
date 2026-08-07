import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const colorSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Please Enter A Name"],
      validate: {
        validator: async function (
          this: { constructor: Model<{ name: string }> },
          name: string,
        ) {
          const existing = await this.constructor.findOne({ name });
          return !existing;
        },
        message: "Name already exists",
      },
    },
    code: {
      type: String,
      required: [true, "Please Enter A Code"],
      match: /^[a-zA-Z0-9# ]+$/,
    },
    status: { type: Boolean, default: true },
    order: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
      match: /^[0-9]+$/,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

colorSchema.index({ deletedAt: 1, status: 1, order: -1 });

export type IColor = InferSchemaType<typeof colorSchema>;

const ColorModel: Model<IColor> = mongoose.model<IColor>("colors", colorSchema);
export default ColorModel;