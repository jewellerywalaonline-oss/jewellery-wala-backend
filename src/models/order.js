const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // Unique order identifier
    orderId: {
      type: String,
      required: true,
      unique: true,
      default: () =>
        `ORD-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase()}`,
    },

    // User information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    // Purchase type: 'cart' or 'direct'
    purchaseType: {
      type: String,
      enum: ["cart", "direct"],
      required: true,
      default: "cart",
    },

    // Items in the order
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
        // Color/Variant ID (required for both cart and direct)
        colorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "colors",
          required: true,
        },
        // Size ID (optional - not all products have sizes)
        sizeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "sizes",
          default: null,
        },
        name: {
          type: String,
          required: true,
        },
        description: String,

        // Quantity (required for both cart and direct)
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },

        // Personalization
        isPersonalized: {
          type: Boolean,
          default: false,
        },
        personalizedName: {
          type: String,
          default: null,
        },

        // Snapshot of price at time of purchase
        priceAtPurchase: {
          type: Number,
          required: true,
        },

        // Subtotal for this item
        subtotal: {
          type: Number,
          required: true,
        },

        // For tracking if item came from cart or was direct purchase
        addedFrom: {
          type: String,
          enum: ["cart", "direct", "wishlist"],
          default: "cart",
        },

        // Product images snapshot (in case product is deleted later)
        images: [String],

        // SKU or unique identifier
        sku: String,
      },
    ],

    // Pricing breakdown
    pricing: {
      subtotal: {
        type: Number,
        required: true,
      },
      advance: {
        type: Number,
        default: 0,
      },
      // Discount applied
      discount: {
        amount: { type: Number, default: 0 },
      },

      // Shipping charges
      shipping: {
        type: Number,
        default: 0,
      },

      // Final total amount
      total: {
        type: Number,
        required: true,
      },
    },

    // Shipping information
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
      area: { type: String, required: true },
      street: { type: String, required: true },
      addressLine1: { type: String, default: "" },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: "India" },
      landmark: { type: String, default: "" },
      instructions: { type: String, default: "" },
    },

    // Billing address (optional, defaults to shipping)
    billingAddress: {
      fullName: String,
      phone: String,
      email: String,
      area: String,
      street: String,
      addressLine1: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
      landmark: String,
      instructions: String,
    },

    // Payment information
    payment: {
      method: {
        type: String,
        enum: ["razorpay", "cod", "upi", "card", "netbanking", "wallet"],
        default: "razorpay",
      },
      status: {
        type: String,
        enum: [
          "pending",
          "processing",
          "cod-advance",
          "completed",
          "failed",
          "refunded",
          "partially_refunded",
        ],
        default: "pending",
        index: true,
      },
      // Razorpay specific fields
      razorpay: {
        orderId: String,
        paymentId: String,
        signature: String,
      },
      // Verification flag
      verified: {
        type: Boolean,
        default: false,
      },
      //cod advance flag
      codAdvance: {
        type: Boolean,
        default: false,
      },
      // Transaction details
      transactionId: String,
      paidAt: Date,
      // For COD
      codCharges: {
        type: Number,
        default: 0,
      },
    },

    // Order status tracking
    status: {
      type: String,
      enum: [
        "pending", // Order created, payment pending
        "payment_failed", // Payment failed
        "confirmed", // Payment successful
        "processing", // Being prepared
        "shipped", // Dispatched
        "cod-advance",
        // "out_for_delivery", // Out for delivery
        "delivered", // Successfully delivered
        "cancelled", // Cancelled by user/admin
        "refunded", // Money refunded
        "returned", // Product returned
        "exchange", // Exchange requested
      ],
      default: "pending",
      index: true,
    },

    // Status history for tracking
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        note: String,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Shipping tracking
    shipping: {
      carrier: String, // Blue Dart, Delhivery, etc.
      trackingNumber: String,
      trackingUrl: String,
      estimatedDelivery: Date,
      shippedAt: Date,
      deliveredAt: Date,
    },

    // Invoice details
    invoice: {
      invoiceNumber: String,
      invoiceUrl: String,
      generatedAt: Date,
    },

    // Special instructions
    notes: {
      customer: String, // Customer notes
      internal: String, // Internal admin notes
    },

    packageId: {
      type: String,
      default: null,
    },

    // Gift options
    isGift: {
      type: Boolean,
      default: false,
    },
    giftMessage: String,
    giftWrap: {
      type: Boolean,
      default: false,
    },
    giftWrapCharges: {
      type: Number,
      default: 0,
    },

    // Cancellation/Return details
    cancellation: {
      reason: String,
      refundId: String,
      cancelledBy: {
        type: String,
        enum: ["customer", "admin", "system"],
      },
      cancelledAt: Date,
      refundStatus: {
        type: String,
        enum: ["pending", "initiated", "completed", "failed"],
      },
      refundAmount: Number,
      refundedAt: Date,
      refundError: String,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "payment.razorpay.orderId": 1 });
orderSchema.index({ "payment.razorpay.paymentId": 1 });

// Virtual for order age
orderSchema.virtual("orderAge").get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // Days
});

// Pre-save middleware to add status to history
orderSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
    });
  }
  next();
});

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
  const cancellableStatuses = ["pending", "confirmed", "processing"];
  return cancellableStatuses.includes(this.status);
};

// Method to check if order can be returned
orderSchema.methods.canBeReturned = function () {
  if (this.status !== "delivered") return false;
  const daysSinceDelivery = Math.floor(
    (Date.now() - this.shipping.deliveredAt) / (1000 * 60 * 60 * 24)
  );
  return daysSinceDelivery <= 7; // 7 days return policy
};

// Static method to get orders by status
orderSchema.statics.getOrdersByStatus = function (status, userId = null) {
  const query = { status };
  if (userId) query.userId = userId;
  return this.find(query).sort({ createdAt: -1 });
};

const OrderModel = mongoose.model("orders", orderSchema);

module.exports = OrderModel;
