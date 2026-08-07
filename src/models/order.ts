import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import crypto from "crypto";

const orderSchema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      default: function () {
        return `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      },
    },
    idempotencyKey: { type: String, sparse: true },
    idempotencyHash: { type: String },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    purchaseType: {
      type: String,
      enum: ["cart", "direct"],
      required: true,
      default: "cart",
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
        colorId: {
          type: Schema.Types.ObjectId,
          ref: "colors",
          required: true,
        },
        sizeId: {
          type: Schema.Types.ObjectId,
          ref: "sizes",
          default: null,
        },
        name: { type: String, required: true },
        description: { type: String },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        isPersonalized: { type: Boolean, default: false },
        personalizedName: { type: String, default: null },
        priceAtPurchase: { type: Number, required: true },
        subtotal: { type: Number, required: true },
        addedFrom: {
          type: String,
          enum: ["cart", "direct", "wishlist"],
          default: "cart",
        },
        images: { type: [String], default: [] },
        sku: { type: String },
        variantName: { type: String, default: null },
      },
    ],
    pricing: {
      subtotal: { type: Number, required: true },
      advance: { type: Number, default: 0 },
      discount: {
        amount: { type: Number, default: 0 },
      },
      shipping: { type: Number, default: 0 },
      total: { type: Number, required: true },
    },
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
    billingAddress: {
      fullName: { type: String },
      phone: { type: String },
      email: { type: String },
      area: { type: String },
      street: { type: String },
      addressLine1: { type: String },
      city: { type: String },
      state: { type: String },
      pincode: { type: String },
      country: { type: String },
      landmark: { type: String },
      instructions: { type: String },
    },
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
      razorpay: {
        orderId: { type: String },
        paymentId: { type: String },
        signature: { type: String },
      },
      verified: { type: Boolean, default: false },
      codAdvance: { type: Boolean, default: false },
      transactionId: { type: String },
      paidAt: { type: Date },
      codCharges: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: [
        "pending",
        "payment_failed",
        "confirmed",
        "processing",
        "shipped",
        "cod-advance",
        "delivered",
        "cancelled",
        "refunded",
        "returned",
        "exchange",
      ],
      default: "pending",
      index: true,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
    shipping: {
      carrier: { type: String },
      trackingNumber: { type: String },
      trackingUrl: { type: String },
      estimatedDelivery: { type: Date },
      shippedAt: { type: Date },
      deliveredAt: { type: Date },
    },
    invoice: {
      invoiceNumber: { type: String },
      invoiceUrl: { type: String },
      generatedAt: { type: Date },
    },
    notes: {
      customer: { type: String },
      internal: { type: String },
    },
    packageId: { type: String, default: null },
    isGift: { type: Boolean, default: false },
    giftMessage: { type: String },
    giftWrap: { type: Boolean, default: false },
    giftWrapCharges: { type: Number, default: 0 },
    cancellation: {
      reason: { type: String },
      refundId: { type: String },
      cancelledBy: {
        type: String,
        enum: ["customer", "admin", "system"],
      },
      cancelledAt: { type: Date },
      refundStatus: {
        type: String,
        enum: ["pending", "initiated", "completed", "failed"],
      },
      refundAmount: { type: Number },
      refundedAt: { type: Date },
      refundError: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

orderSchema.index({ userId: 1, createdAt: -1 });

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "payment.razorpay.orderId": 1 });
orderSchema.index({ "payment.razorpay.paymentId": 1 });

orderSchema.virtual("orderAge").get(function () {
  return Math.floor(
    (Date.now() - (this as { createdAt: Date }).createdAt.getTime()) /
      (1000 * 60 * 60 * 24),
  );
});

orderSchema.pre("save", function (next) {
  const self = this as { isModified: (k: string) => boolean; status: string; statusHistory: { status: string; timestamp: Date }[] };
  if (self.isModified("status")) {
    self.statusHistory.push({
      status: self.status,
      timestamp: new Date(),
    });
  }
  next();
});

orderSchema.methods.canBeCancelled = function () {
  const cancellableStatuses = ["pending", "confirmed", "processing"];
  return cancellableStatuses.includes(this.status as string);
};

orderSchema.methods.canBeReturned = function () {
  if (this.status !== "delivered") return false;
  const deliveredAt = (this as { shipping?: { deliveredAt?: Date } }).shipping
    ?.deliveredAt;
  if (!deliveredAt) return false;
  const daysSinceDelivery = Math.floor(
    (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysSinceDelivery <= 7;
};

orderSchema.statics.getOrdersByStatus = function (
  status: string,
  userId: string | null = null,
) {
  const query: Record<string, unknown> = { status };
  if (userId) query.userId = userId;
  return this.find(query).sort({ createdAt: -1 });
};

// Idempotency is enforced at the application layer within the same checkout
// session by checking order status (pending / payment_failed).  A DB-level
// unique index is intentionally omitted so that users can freely re-order
// the same products days or weeks later without the old key blocking them.

export type IOrder = InferSchemaType<typeof orderSchema>;

// Allow model re-compilation for seamless index sync
const OrderModel = (mongoose.models.orders ?? mongoose.model("orders", orderSchema)) as Model<IOrder>;

export default OrderModel;