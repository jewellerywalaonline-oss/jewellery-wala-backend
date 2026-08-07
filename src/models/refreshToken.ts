import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    type: {
      type: String,
      enum: ["user", "admin", "delivery"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true },
);

export type IRefreshToken = InferSchemaType<typeof refreshTokenSchema>;

const RefreshTokenModel: Model<IRefreshToken> = mongoose.model<IRefreshToken>(
  "refreshTokens",
  refreshTokenSchema,
);

export default RefreshTokenModel;
