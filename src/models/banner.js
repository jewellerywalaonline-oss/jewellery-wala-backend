const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    image: { type: String, required: [true, "image is required"] },
    description: { type: String, required: [true, "description is required"] },
    deletedAt: { type: Date , default: null },
  },
  { timestamps: true }
);

const bannerModal = mongoose.model("banners", bannerSchema);

module.exports = bannerModal;
