/**
 * @openapi
 * tags:
 *   - name: Admin - Orders
 *     description: Admin order management and refund processing
 *
 * /api/admin/orders/all:
 *   post:
 *     tags: [Admin - Orders]
 *     summary: Get all orders (paginated)
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
 *         description: Forbidden
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
 * /api/admin/orders/mark-to-shipped:
 *   post:
 *     tags: [Admin - Orders]
 *     summary: Mark order as shipped
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
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
 *         description: Forbidden
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
 * /api/admin/orders/cancel-by-admin:
 *   post:
 *     tags: [Admin - Orders]
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
 *         description: Forbidden
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
 * /api/admin/orders/refunded:
 *   get:
 *     tags: [Admin - Orders]
 *     summary: Get all refunded orders
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Refunded orders list
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
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
 * /api/admin/orders/refund/verify/{orderId}:
 *   get:
 *     tags: [Admin - Orders]
 *     summary: Verify refund status from Razorpay
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
 *         description: Refund status verified
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
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
 * /api/admin/orders/refund/{orderId}:
 *   patch:
 *     tags: [Admin - Orders]
 *     summary: Update single order refund status with Razorpay verification
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
 *         description: Refund status updated
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
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
 * /api/admin/orders/refund/sync:
 *   post:
 *     tags: [Admin - Orders]
 *     summary: Sync all refund statuses from Razorpay
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Refund sync completed
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
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
 * /api/admin/orders/refund/bulk:
 *   post:
 *     tags: [Admin - Orders]
 *     summary: Bulk update refund statuses
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminBulkRefundInput'
 *     responses:
 *       200:
 *         description: Bulk refund update completed
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
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
 * /api/admin/orders/deliever/order:
 *   post:
 *     tags: [Admin - Orders]
 *     summary: Mark order as delivered
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Order delivered
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
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
 * /api/admin/orders/verify-pending-payments:
 *   post:
 *     tags: [Admin - Orders]
 *     summary: Verify pending payments
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Pending payments verified
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
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
 * /api/admin/orders/confirm-pending-payment:
 *   post:
 *     tags: [Admin - Orders]
 *     summary: Confirm a pending payment manually
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminPendingPaymentInput'
 *     responses:
 *       200:
 *         description: Payment confirmed
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
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

import { Router } from "express";
import {
  getRefundedOrdersForAdmin,
  verifyRefundStatus,
  updateRefundStatus,
  syncRefundStatusesFromRazorpay,
  bulkUpdateRefundStatus,
  delieverOrder,
  verifyPendingPayments,
  confirmPendingPayment,
} from "../../controller/admin/adminOrder.controller.js";
import {
  getAllOrders,
  markToShipped,
  cancelOrderByAdmin,
} from "../../controller/web/order.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/all", protect, adminOnly, getAllOrders);
router.post("/mark-to-shipped", protect, adminOnly, uploadNone, markToShipped);
router.post("/cancel-by-admin", protect, adminOnly, uploadNone, cancelOrderByAdmin);

// Get all refunded orders (admin only)
router.get("/refunded", protect, adminOnly, getRefundedOrdersForAdmin);

// Verify refund status from Razorpay
router.get("/refund/verify/:orderId", protect, adminOnly, verifyRefundStatus);

// Update single order refund status (with Razorpay verification)
router.patch("/refund/:orderId", protect, adminOnly, updateRefundStatus);

// Sync all refund statuses from Razorpay
router.post("/refund/sync", protect, adminOnly, syncRefundStatusesFromRazorpay);

// Bulk update refund status
router.post("/refund/bulk", protect, adminOnly, bulkUpdateRefundStatus);

router.post("/deliever/order", protect, adminOnly, delieverOrder);

// verify pending payments
router.post("/verify-pending-payments", protect, adminOnly, verifyPendingPayments);

// confirm pending payment
router.post("/confirm-pending-payment", protect, adminOnly, confirmPendingPayment);

export default router;
