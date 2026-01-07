// In your routes file (e.g., orderRoutes.js)
const express = require("express");
const router = express.Router();
const {
  getRefundedOrdersForAdmin,
  verifyRefundStatus,
  updateRefundStatus,
  syncRefundStatusesFromRazorpay,
  bulkUpdateRefundStatus,
  delieverOrder,
} = require("../../controller/admin/adminOrder.controller"); // Adjust path

const protect = require("../../middleware/authMiddleware");

// Get all refunded orders (admin only)
router.get("/admin/refunded", protect, getRefundedOrdersForAdmin);

// Verify refund status from Razorpay
router.get("/admin/refund/verify/:orderId", protect, verifyRefundStatus);

// Update single order refund status (with Razorpay verification)
router.patch("/admin/refund/:orderId", protect, updateRefundStatus);

// Sync all refund statuses from Razorpay
router.post("/admin/refund/sync", protect, syncRefundStatusesFromRazorpay);

// Bulk update refund status
router.post("/admin/refund/bulk", protect, bulkUpdateRefundStatus);

router.post("/deliever/order", protect, delieverOrder);

module.exports = router;
