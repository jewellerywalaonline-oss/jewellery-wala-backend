const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../../models/order.js");
const Product = require("../../models/product.js");
const Cart = require("../../models/cart.js");
const { sendEmail } = require("../../lib/nodemailer");
const userModel = require("../../models/user.js");
require("dotenv").config();
// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generatePackageId = () => {
  const string = process.env.APP_NAME;
  return string + "-" + Math.floor(100000 + Math.random() * 900000).toString();
};

// 1. Create Order (from Cart or Direct Purchase)
exports.createOrder = async (req, res) => {
  try {
    const {
      purchaseType, // 'cart' or 'direct'
      items,
      isPersonalizedName,
      // For direct purchase: [{ productId, colorId, quantity, isPersonalized, personalizedName }]
      shippingAddress,
      billingAddress,
      notes,
      isGift,
      giftMessage,
      giftWrap,
      couponCode,
    } = req.body;

    const userId = req.user._id; // From auth middleware

    let orderItems = [];
    let subtotal = 0;

    // Handle Cart Purchase
    if (purchaseType === "cart") {
      const cart = await Cart.findOne({ user: userId })
        .populate("items.product")
        .lean();

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Cart is empty",
        });
      }

      // Process cart items
      for (const cartItem of cart.items) {
        const product = cartItem.product;

        const itemSubtotal = product.discount_price * cartItem.quantity;
        subtotal += itemSubtotal;

        orderItems.push({
          productId: product._id,
          colorId: cartItem.color,
          name: product.name,
          description: product.description,
          quantity: cartItem.quantity,
          isPersonalized: cartItem.isPersonalized || false,
          personalizedName: cartItem.isPersonalized
            ? cartItem.personalizedName
            : null,
          priceAtPurchase: product.price,
          subtotal: itemSubtotal,
          addedFrom: "cart",
          images: product.images,
          sku: product.sku,
        });
      }
    }

    // Handle Direct Purchase
    else if (purchaseType === "direct") {
      for (const item of items) {
        const product = await Product.findById(item.productId);

        if (!product) {
          return res.status(404).json({
            success: false,
            message: "Product not found",
          });
        }

        const itemSubtotal = product.discount_price * item.quantity;
        subtotal += itemSubtotal;

        orderItems.push({
          productId: product._id,
          colorId: item.colorId,
          name: product.name,
          description: product.description,
          quantity: item.quantity,
          isPersonalized: product.isPersonalized || false,
          personalizedName: product.isPersonalized ? isPersonalizedName : null,
          priceAtPurchase: product.discount_price,
          subtotal: itemSubtotal,
          addedFrom: "direct",
          images: product.images,
          sku: product.sku,
        });
      }
    }

    // Calculate pricing
    let discount = 0;
    let couponId = null;

    // if (couponCode) {
    //   // Validate and apply coupon
    //   // discount = ...
    //   // couponId = ...
    // }

    const shipping = subtotal > 1000 ? 0 : 50; // Free shipping above ₹1000
    const giftWrapCharges = giftWrap ? 50 : 0;
    const total = subtotal - discount + shipping + giftWrapCharges;

    // Create order
    const order = new Order({
      userId,
      purchaseType,
      items: orderItems,
      pricing: {
        subtotal,
        discount: {
          amount: discount,
          couponCode: couponCode || null,
          couponId,
        },
        shipping,
        total,
      },
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      notes: {
        customer: notes || "",
      },
      isGift: isGift || false,
      giftMessage: giftMessage || null,
      giftWrap: giftWrap || false,
      giftWrapCharges,
      status: "pending",
      payment: {
        status: "pending",
      },
    });

    await order.save();

    try {
      const user = await userModel.findById(userId);

      if (!user.mobile || user.mobile === "") {
        user.mobile = shippingAddress.phone;
        user.isMobileVerified = true;
      }
      if (user.address.pincode == "")
        user.address.pincode = shippingAddress.pincode;
      if (user.address.state == "") user.address.state = shippingAddress.state;
      if (user.address.city == "") user.address.city = shippingAddress.city;
      if (user.address.street == "")
        user.address.street = shippingAddress.street;
      if (user.address.area == "") user.address.area = shippingAddress.area;

      await user.save();
    } catch (error) {
      console.log(error);
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: {
        orderId: order.orderId,
        _id: order._id,
        total: order.pricing.total,
      },
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// 2. Create Razorpay Order
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user._id;

    // Find order
    const order = await Order.findOne({ orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order is pending
    if (order.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Order is not in pending state",
      });
    }
    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: order.pricing.total * 100, // Amount in paise
      currency: "INR",
      receipt: order.orderId,
      notes: {
        orderId: order.orderId,
        userId: userId.toString(),
      },
    });
    // Update order with Razorpay order ID
    order.payment.razorpay.orderId = razorpayOrder.id;
    await order.save();

    res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: order.pricing.total,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Create Razorpay Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
      error: error.message,
    });
  }
};

// 3. Verify Payment (MOST CRITICAL)
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    const userId = req.user._id;

    // Find order
    const order = await Order.findOne({ orderId, userId }).populate(
      "items.productId"
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Payment verification failed
      order.status = "payment_failed";
      order.payment.status = "failed";
      await order.save();

      // Send failure email asynchronously (don't await)
      sendEmail(order.shippingAddress.email, "paymentFailed", {
        orderId: order.orderId,
        customerName: order.shippingAddress.name || "Customer",
        orderTotal: `₹${order.pricing.total}`,
        contactEmail: process.env.MY_GMAIL,
      }).catch((err) =>
        console.error("Failed to send payment failure email:", err)
      );

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // Verify amount with Razorpay
    const razorpayOrderDetails = await razorpay.orders.fetch(razorpay_order_id);
    const expectedAmount = order.pricing.total * 100; // Amount in paise

    if (razorpayOrderDetails.amount !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: "Amount mismatch",
      });
    }

    // Payment successful - Update order status first
    order.status = "confirmed";
    order.payment.status = "completed";
    order.payment.verified = true;
    order.payment.razorpay.paymentId = razorpay_payment_id;
    order.payment.razorpay.signature = razorpay_signature;
    order.payment.transactionId = razorpay_payment_id;
    order.payment.paidAt = new Date();

    // Generate OTP for delivery
    const deliveryOTP = generateOTP();
    order.notes.internal = `Delivery OTP: ${deliveryOTP}`;

    // Generate package ID
    const packageId = generatePackageId();
    order.packageId = packageId;

    await order.save();

    // Send response immediately
    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order: {
        orderId: order.orderId,
        status: order.status,
        deliveryOTP,
        packageId,
      },
    });

    // Handle post-response operations asynchronously
    setImmediate(async () => {
      try {
        // Reduce stock for each item
        const stockUpdatePromises = order.items.map((item) =>
          Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: -item.quantity },
          }).catch((err) =>
            console.error(
              `Failed to update stock for product ${item.productId}:`,
              err
            )
          )
        );

        // Clear cart if order was from cart
        let cartClearPromise = Promise.resolve();
        if (order.purchaseType === "cart") {
          cartClearPromise = Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } }
          ).catch((err) => console.error("Failed to clear cart:", err));
        }

        // Send confirmation email
        const emailPromise = sendEmail(
          order.shippingAddress.email,
          "orderConfirmed",
          {
            orderId: order.orderId,
            packageId: packageId,
            orderDate: new Date().toLocaleString(),
            customerName: order.shippingAddress.name || "Customer",
            orderTotal: order.pricing.total,
            subtotal: order.pricing.subtotal,
            discount: order.pricing.discount?.amount || 0,
            shipping: order.pricing.shipping,
            total: order.pricing.total,
            deliveryOTP: deliveryOTP,
            contactEmail: process.env.MY_GMAIL,
            items: order.items,
            shippingAddress: order.shippingAddress,
            billingAddress: order.billingAddress || order.shippingAddress,
            paymentMethod: "Online Payment",
          }
        ).catch((err) =>
          console.error("Failed to send order confirmation email:", err)
        );

        // Wait for all operations to complete
        await Promise.all([
          ...stockUpdatePromises,
          cartClearPromise,
          emailPromise,
        ]);

        console.log(`Post-payment operations completed for order ${orderId}`);
      } catch (error) {
        console.error("Error in post-payment operations:", error);
        // Consider implementing a retry mechanism or dead letter queue here
      }
    });
  } catch (error) {
    console.error("Verify Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

// 5. Get User Orders
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("items.productId", "name images slug")
      .lean();

    const count = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      orders,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalOrders: count,
    });
  } catch (error) {
    console.error("Get User Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// 6. Get Single Order
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({ orderId, userId })
      .populate("items.productId", "name images slug")
      .select("-payment.razorpay.signature")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate("items.productId", "name images slug")
      .select("-payment.razorpay.signature")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// 7. Cancel Order
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const order = await Order.findOne({ orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order is within 1 day (24 hours) of creation
    const orderCreatedAt = new Date(order.createdAt);
    const currentTime = new Date();
    const timeDifference = currentTime - orderCreatedAt;
    const oneDayInMilliseconds = 24 * 60 * 60 * 1000;

    if (
      order.payment.status !== "pending" &&
      timeDifference > oneDayInMilliseconds
    ) {
      return res.status(400).json({
        success: false,
        message: "Order can only be cancelled within 24 hours of placement",
      });
    }

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity },
      });
    }

    // Update order status
    order.status = "cancelled";
    order.cancellation = {
      reason,
      cancelledBy: "customer",
      cancelledAt: new Date(),
    };

    // Handle refund only if payment was completed
    if (order.payment.status !== "pending") {
      const refundAmount = order.pricing.total;

      // Initiate refund with Razorpay
      try {
        const refund = await razorpay.payments.refund(
          order.payment.razorpay.paymentId,
          {
            amount: refundAmount * 100,
            speed: "normal",
            notes: {
              orderId: order.orderId,
              reason,
            },
          }
        );

        // Update refund status if successful
        order.cancellation.refundStatus = "initiated";
        order.cancellation.refundId = refund.id;
        order.cancellation.refundAmount = refundAmount;
      } catch (error) {
        console.error("Refund initiation failed:", error);
        // Continue with cancellation even if refund fails
        order.cancellation.refundStatus = "failed";
        order.cancellation.refundError = error.message;
      }
    }

    await order.save();

    // Send cancellation email
    try {
      await sendEmail(order.shippingAddress.email, "orderCancelled", {
        user: {
          name: order.shippingAddress.name,
          email: order.shippingAddress.email,
        },
        order: {
          _id: order._id,
          orderId: order.orderId,
          createdAt: order.createdAt,
          pricing: order.pricing,
          cancellation: order.cancellation,
          shippingAddress: order.shippingAddress,
          pendingStatus: order.payment.status ? true : false,
        },
      });
    } catch (emailError) {
      console.error("Failed to send cancellation email:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Cancel Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

// 8. Verify Delivery OTP
exports.verifyDeliveryOTP = async (req, res) => {
  try {
    const { orderId, otp } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "shipped") {
      return res.status(400).json({
        success: false,
        message: "Order cannot be marked as delivered",
      });
    }

    // Extract OTP from internal notes
    const storedOTP = order.notes.internal?.match(/Delivery OTP: (\d{6})/)?.[1];

    if (!storedOTP || storedOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    order.status = "delivered";
    order.shipping.deliveredAt = new Date();

    try {
      await sendEmail(order.shippingAddress.email, "orderDelivered", {
        user: {
          name: order.shippingAddress.name,
          email: order.shippingAddress.email,
        },
        order: {
          _id: order._id,
          orderId: order.orderId,
          shipping: order.shipping,
          shippingAddress: order.shippingAddress,
          items: order.items,
          totalAmount: order.pricing.total,
        },
      });
    } catch (emailError) {
      console.error("Failed to send delivery confirmation email:", emailError);
      // Don't fail the request if email fails
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order delivered successfully",
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
};

exports.markToShipped = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Order cannot be marked as shipped",
      });
    }

    order.status = "shipped";
    await order.save();

    try {
      // Send shipping confirmation email
      await sendEmail(order.shippingAddress.email, "orderShipped", {
        user: {
          name: order.shippingAddress.name,
          email: order.shippingAddress.email,
        },
        order: {
          _id: order._id,
          orderId: order.orderId,
        },
      });
    } catch (emailError) {
      console.error("Failed to send shipping email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: "Order marked as shipped successfully",
    });
  } catch (error) {
    console.error("Mark to Shipped Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark order as shipped",
      error: error.message,
    });
  }
};
// In src/controller/web/order.controller.js

// Add this function before the module.exports
exports.sendDeliveryOTP = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ orderId }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    try {
      // Send delivery OTP email
      await sendEmail(order.shippingAddress.email, "orderDeliveryOTP", {
        user: {
          name: order.shippingAddress.name,
          email: order.shippingAddress.email,
        },
        order: {
          orderId: order.orderId,
          _id: order._id,
        },
        otp: order.notes.internal,
      });
    } catch (emailError) {
      console.error("Failed to send delivery OTP email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: "Delivery OTP sent successfully",
    });
  } catch (error) {
    console.error("Send Delivery OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send delivery OTP",
      error: error.message,
    });
  }
};

//
exports.getAllOrders = async (req, res) => {
  let query = { deletedAt: null };
  if (req.body.status) {
    query.status = req.body.status;
  }
  try {
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate("items.productId", "name images slug")
      .select("-payment.razorpay.signature")
      .lean();

    res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    console.error("Get All Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// razorpay webhook
exports.handleWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature
    const signature = req.headers["x-razorpay-signature"];
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload.refund.entity;

    // Handle different refund events
    switch (event) {
      case "refund.created":
        await handleRefundCreated(payload);
        break;
      case "refund.processed":
        await handleRefundProcessed(payload);
        break;
      case "refund.failed":
        await handleRefundFailed(payload);
        break;
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

async function handleRefundProcessed(refundData) {
  const order = await Order.findOne({
    "cancellation.refundId": refundData.id,
  });

  if (order) {
    order.cancellation.refundStatus = "completed";
    order.cancellation.refundProcessedAt = new Date();
    await order.save();

    // Send confirmation email
    await sendEmail(
      order.shippingAddress.email,
      "Refund Processed",
      `Your refund of ₹${refundData.amount / 100} for order ${
        order.orderId
      } has been processed successfully.`
    );
  }
}

async function handleRefundFailed(refundData) {
  const order = await Order.findOne({
    "cancellation.refundId": refundData.id,
  });

  if (order) {
    order.cancellation.refundStatus = "failed";
    order.cancellation.refundError = refundData.error_description;
    await order.save();
  }
}

async function handleRefundCreated(refundData) {
  const order = await Order.findOne({
    "cancellation.refundId": refundData.id,
  });

  if (order) {
    order.cancellation.refundStatus = "processing";
    await order.save();
  }
}
