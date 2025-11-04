const mongoose = require("mongoose");

const logoSchema = new mongoose.Schema(
  {
    logo: {
      type: String,
      required: [true , "logo is required"],
    },
    status: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Logos", logoSchema);
