/**
 * @openapi
 * tags:
 *   - name: Orders
 *     description: Order management and payment processing
 *
 * /api/website/orders/create:
 *   post:
 *     tags: [Orders]
 *     summary: Create new order
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderInput'
 *     responses:
 *       201:
 *         description: Order created
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/create-razorpay-order:
 *   post:
 *     tags: [Orders]
 *     summary: Create Razorpay payment order
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRazorpayOrderInput'
 *     responses:
 *       200:
 *         description: Razorpay order created
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/verify-payment:
 *   post:
 *     tags: [Orders]
 *     summary: Verify Razorpay payment
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyPaymentInput'
 *     responses:
 *       200:
 *         description: Payment verified
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/my-orders:
 *   get:
 *     tags: [Orders]
 *     summary: Get user's orders
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: User's orders
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/{orderId}:
 *   get:
 *     tags: [Orders]
 *     summary: Get order by ID
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order details
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/delivery/{orderId}:
 *   post:
 *     tags: [Orders]
 *     summary: Get order delivery details
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order delivery info
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/{orderId}/cancel:
 *   put:
 *     tags: [Orders]
 *     summary: Cancel order
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelOrderInput'
 *     responses:
 *       200:
 *         description: Order cancelled
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/webhooks/razorpay:
 *   post:
 *     tags: [Orders]
 *     summary: Razorpay webhook handler
 *     responses:
 *       200:
 *         description: Webhook processed
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/verify-delivery-otp:
 *   post:
 *     tags: [Orders]
 *     summary: Verify delivery OTP
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyDeliveryOtpInput'
 *     responses:
 *       200:
 *         description: Delivery confirmed
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/mark-to-shipped:
 *   post:
 *     tags: [Orders]
 *     summary: Mark order as shipped (admin only)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId: { type: string }
 *     responses:
 *       200:
 *         description: Order marked as shipped
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/send-delivery-otp:
 *   post:
 *     tags: [Orders]
 *     summary: Send delivery OTP email
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId: { type: string }
 *     responses:
 *       200:
 *         description: OTP sent
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/buy-with-cod:
 *   post:
 *     tags: [Orders]
 *     summary: Confirm COD order
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId: { type: string }
 *     responses:
 *       200:
 *         description: COD order confirmed
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/cancel-by-admin:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel order by admin
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Order cancelled
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/orders/all:
 *   post:
 *     tags: [Orders]
 *     summary: Get all orders (admin only)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: All orders
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router, raw } from "express";
import {
  createOrder,
  createRazorpayOrder,
  retryPayment,
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
  cancelOrderByAdmin,
  syncStuckPayments,
} from "../../controller/web/order.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";
import rateLimit from "../../middleware/rateLimit.js";

const router = Router();

// Create order (from cart or direct purchase)
router.post("/create", protect, rateLimit.orderCreate, createOrder);

// Create Razorpay order
router.post("/create-razorpay-order", protect, rateLimit.orderCreate, createRazorpayOrder);

// Retry payment for failed orders
router.post("/retry-payment/:orderId", protect, rateLimit.orderCreate, retryPayment);

// Verify payment
router.post("/verify-payment", protect, rateLimit.orderVerify, verifyPayment);

// Get all user orders (with pagination and filters)
router.get("/my-orders", rateLimit.orderRead, protect, uploadNone, getUserOrders);

// Get single order details
router.get("/:orderId", rateLimit.orderRead, protect, uploadNone, getOrderById);

// Get single order details
router.post("/delivery/:orderId", rateLimit.orderRead, protect, uploadNone, getOrder);

// Cancel order
router.put("/:orderId/cancel", protect, uploadNone, rateLimit.cancelOrder, cancelOrder);

// Razorpay webhook
router.post(
  "/webhooks/razorpay",
  raw({ type: "application/json" }),
  rateLimit.webhook,
  handleWebhook,
);

// Verify delivery OTP (can be used by delivery person)
router.post("/verify-delivery-otp", protect, uploadNone, rateLimit.verifyDeliveryOTP, verifyDeliveryOTP);

router.post("/mark-to-shipped", protect, adminOnly, uploadNone, markToShipped);
router.post(
  "/send-delivery-otp",
  protect,
  rateLimit.sendDeliveryOTP,
  uploadNone,
  sendDeliveryOTP,
);

router.post("/buy-with-cod", protect, rateLimit.orderCOD, uploadNone, confirmCODOrder);

router.post("/cancel-by-admin", protect, adminOnly, uploadNone, cancelOrderByAdmin);

// Sync stuck payments — checks all pending orders against Razorpay for captured payments
router.post("/sync-stuck-payments", protect, adminOnly, uploadNone, syncStuckPayments);

router.post("/all", protect, adminOnly, uploadNone, getAllOrders);

export default router;
