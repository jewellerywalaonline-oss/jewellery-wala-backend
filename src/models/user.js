const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please Enter A Name"],
      minlenght: 3,
      maxlenght: 20,
      match: /^[a-zA-Z 0-9"' ]{3,20}$/,
    },
    gender: {
      type: String,
      default: "male",
      enum: ["male", "female", "other"],
    },
    address: {
      type: {
        pincode: {
          type: Number,
        },
        state: {
          type: String,
        },
        city: {
          type: String,
        },
        street: {
          type: String,
        },
        area: {
          type: String,
        },
        instructions: {
          type: String,
        },
      },
      default: {},
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
      required: [true, "Password IS Required"],
      minlenght: 6,
    },
    mobile: {
      type: Number,
      default: "",
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
      match: /^[0-9]+$/,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const userModel = mongoose.model("users", userSchema);

module.exports = userModel;
