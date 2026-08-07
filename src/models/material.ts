import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const materialSchema = new Schema(
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

materialSchema.index({ deletedAt: 1, status: 1, order: -1 });

export type IMaterial = InferSchemaType<typeof materialSchema>;

const MaterialModel: Model<IMaterial> = mongoose.model<IMaterial>(
  "materials",
  materialSchema,
);

export default MaterialModel;