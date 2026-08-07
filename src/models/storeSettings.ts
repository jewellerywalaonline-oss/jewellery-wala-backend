import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const SETTINGS_ID = "global"

const storeSettingsSchema = new Schema(
  {
    _id: { type: String, default: SETTINGS_ID },
    // Fixed single-document ID — always upsert with _id: "global"
    storePickupPincode: {
      type: String,
      default: "",
      validate: {
        validator: (v: string) => !v || /^\d{6}$/.test(v),
        message: "Pickup pincode must be a valid 6-digit pincode",
      },
    },
  },
  {
    timestamps: true,
  },
);

export type IStoreSettings = InferSchemaType<typeof storeSettingsSchema>;

const StoreSettings = mongoose.model<IStoreSettings>(
  "StoreSettings",
  storeSettingsSchema,
);

export default StoreSettings;
