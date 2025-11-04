const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Please Enter A Question"],
      minlenght: 3,
      maxlenght: 20,
      match: /^[a-zA-Z 0-9!@#$%^&*,.'"?]+$/,
      validate: {
        validator: async function (question) {
          const existingColor = await this.constructor.findOne({
            question,
            deleted_at: null,
          });
          return !existingColor;
        },
        message: "Question already exists",
      },
    },
    answer: {
      type: String,
      required: [true, "Please Enter A Answer"],
      minlenght: 5,
      match: /^[a-zA-Z 0-9_\-#!@"';.,/? ]+$/,
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

const faqModal = mongoose.model("faqs", faqSchema);

module.exports = faqModal;
