const mongoose = require("mongoose");

const whyChooseUsSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"] },
    description: { type: String, required: [true, "Description is required"] },
    image: { type: String, required: [true, "Image is required"] },
    status: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("WhyChooseUs", whyChooseUsSchema);
