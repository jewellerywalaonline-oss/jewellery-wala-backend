const express = require("express");
const {
  createOrder,
  createRazorpayOrder,
  verifyPayment,
  handleWebhook,
  getUserOrders,
  getOrderById,
  cancelOrder,
  verifyDeliveryOTP,
  markToShipped,
  getAllOrders,
  getOrder,
  sendDeliveryOTP,
  confirmCODOrder,
} = require("../../controller/web/order.controller.js");
const protect = require("../../middleware/authMiddleware.js"); // Your auth middleware
const { uploadNone } = require("../../middleware/uploadMiddleware.js");
const router = express.Router();
const rateLimit = require("../../middleware/rateLimit.js");
// Create order (from cart or direct purchase)
router.post("/create", protect, createOrder);

// Create Razorpay order
router.post("/create-razorpay-order", protect, createRazorpayOrder);

// Verify payment
router.post("/verify-payment", protect, verifyPayment);

// Get all user orders (with pagination and filters)
router.get("/my-orders", protect, uploadNone, getUserOrders);

// Get single order details
router.get("/:orderId", protect, uploadNone, getOrderById);

// Get single order details
router.post("/delivery/:orderId", protect, uploadNone, getOrder);

// Cancel order
router.put("/:orderId/cancel", protect, uploadNone, cancelOrder);

// Razorpay webhook
router.post(
  "/webhooks/razorpay", // More specific and descriptive
  express.raw({ type: "application/json" }),
  handleWebhook
);

// Verify delivery OTP (can be used by delivery person)
router.post("/verify-delivery-otp", protect, uploadNone, verifyDeliveryOTP);

router.post("/mark-to-shipped", protect, uploadNone, markToShipped);
router.post(
  "/send-delivery-otp",
  protect,
  rateLimit.sendDeliveryOTP,
  uploadNone,
  sendDeliveryOTP
);

router.post("/buy-with-cod", protect, uploadNone, confirmCODOrder);

router.post("/all", protect, uploadNone, getAllOrders);

module.exports = router;
