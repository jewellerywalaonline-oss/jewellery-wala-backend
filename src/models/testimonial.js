const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    rating: {
      type: Number,
      required: [true, "Enter A Valid Rating"],
    },
    image: {
      type: String,
      required: [true, "Image is required"],
    },
    address: {
      type: String,
      required: [true, "A Valid Address Is Required"],
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

module.exports = mongoose.model("Testimonials", testimonialSchema);
