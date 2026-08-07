import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const logoSchema = new Schema(
  {
    logo: { type: String, required: [true, "logo is required"] },
    status: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type ILogo = InferSchemaType<typeof logoSchema>;

const Logo: Model<ILogo> = mongoose.model<ILogo>("Logos", logoSchema);
export default Logo;