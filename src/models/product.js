const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please Enter A Name"],
      minlength: 3,
      
      match: /^[a-zA-Z 0-9"' ]+$/,
     
    },
    slug: {
      type: String,
      required: [true, "Please Enter A Slug"],
    },
    image: {
      type: String,
      required: [true, "Please Enter A Image"],
    },
    images: [
      {
        type: String,
        default: "",
        required: [true, "Please Enter A Image"],
      },
    ],
    colors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "colors",
        required: [true, "Please Enter A Color"],
      },
    ],
    material: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "materials",
        required: [true, "Please Enter A Material"],
      },
    ],
    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Categories",
        required: [true, "Category is required"],
      },
    ],
    subCategory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategories",
        required: [true, " Sub Category is required"],
      },
    ],
    subSubCategory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubSubCategories",
       
      },
    ],

    description: {
      type: String,
      required: [true, "Please enter a description"],
    },

    purity: {
      type: String,
      required: [true, "Please enter a purity"],
    },
    code: {
      type: String,
      required: [true, "Please enter a code"],
    },
    price: {
      type: Number,
      required: [true, "Please enter a price"],
    },
    discount_price: {
      type: Number,
      required: [true, "Please enter a discount price"],
    },
    stock: {
      type: Number,
      required: [true, "Please enter a stock"],
    },
    estimated_delivery_time: {
      type: String,
      required: [true, "Please enter a estimated delivery time"],
    },
    status: {
      type: Boolean,
      required: [true, "Please enter a status"],
    },
    isPersonalized: {
      type: Boolean,
      default: false,
    },
    isGift: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    isTopRated: {
      type: Boolean,
      default: false,
    },
    isUpsell: {
      type: Boolean,
      default: false,
    },
    isOnSale: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: null,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
      max: 100000,
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

productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ subCategory: 1 });
productSchema.index({ subSubCategory: 1 });
productSchema.index({ colors: 1 });
productSchema.index({ material: 1 });

const productModal = mongoose.model("products", productSchema);

module.exports = productModal;
