const mongoose = require("mongoose");

const sizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please Enter A Name"],
      minlenght: 3,
      maxlenght: 20,
     
      validate: {
        validator: async function (name) {
          const existingSize = await this.constructor.findOne({
            name,
            deletedAt: null,
          });
          return !existingSize;
        },
        message: "Name already exists",
      },
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
  { timestamps: true }
);

const sizeModal = mongoose.model("sizes", sizeSchema);

module.exports = sizeModal;
