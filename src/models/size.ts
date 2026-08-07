import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const sizeSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Please Enter A Name"],
      validate: {
        validator: async function (this: { constructor: Model<{ name: string; deletedAt: Date | null }>; isModified: (k: string) => boolean }, name: string) {
          if (!this.isModified("name")) return true;
          const existing = await this.constructor.findOne({
            name,
            deletedAt: null,
          });
          return !existing;
        },
        message: "Name already exists",
      },
    },
    status: { type: Boolean, default: true },
    order: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

sizeSchema.index({ deletedAt: 1, status: 1, order: -1 });

export type ISize = InferSchemaType<typeof sizeSchema>;

const SizeModel: Model<ISize> = mongoose.model<ISize>("sizes", sizeSchema);
export default SizeModel;
