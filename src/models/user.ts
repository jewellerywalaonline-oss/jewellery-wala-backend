import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Please Enter A Name"],
    },
    gender: {
      type: String,
      default: "male",
      enum: ["male", "female", "other"],
    },
    address: {
      pincode: {
        type: Number,
        default: null,
      },
      state: {
        type: String,
        default: "",
      },
      city: {
        type: String,
        default: "",
      },
      street: {
        type: String,
        default: "",
      },
      area: {
        type: String,
        default: "",
      },
      instructions: {
        type: String,
        default: "",
      },
    },
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin", "delivery"],
    },
    avatar: {
      type: String,
      default: null,
    },
    avatarFileName: {
      type: String,
      default: null,
    },
    avatarFileId: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      required: [true, "Email IS Required"],
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Email must be in valid format (e.g.- user@example.com)",
      ],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      maxlength: [128, "Password must not exceed 128 characters"],
    },
    mobile: {
      type: Number,
      default: null,
    },
    isMobileVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Auth indexes
userSchema.index({ email: 1 });
userSchema.index({ email: 1, role: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ deletedAt: 1, status: 1 });

export type IUser = InferSchemaType<typeof userSchema>;

const userModel: Model<IUser> = mongoose.model<IUser>("users", userSchema);

export default userModel;