const Order = require("../../models/order.js");
const mongoose = require("mongoose");
const Product = require("../../models/product.js");
const Cart = require("../../models/cart.js");
const { sendEmail } = require("../../lib/nodemailer");
const userModel = require("../../models/user.js");
const Razorpay = require("razorpay");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
// Helper function to fetch refund status from Razorpay
const fetchRazorpayRefundStatus = async (paymentId, refundId) => {
  try {
    if (!paymentId) {
      return { error: "Payment ID not found" };
    }

    // If refundId is provided, fetch specific refund
    if (refundId) {
      const refund = await razorpay.refunds.fetch(refundId);
      return {
        status: refund.status,
        amount: refund.amount / 100,
        id: refund.id,
        created_at: refund.created_at,
        error: null,
      };
    }
    console.log("refunds", refund);
    // Fetch all refunds for this payment
    const refunds = await razorpay.refunds.all({ payment_id: paymentId });

    if (refunds.items.length > 0) {
      const latestRefund = refunds.items[0];
      return {
        status: latestRefund.status,
        amount: latestRefund.amount / 100,
        id: latestRefund.id,
        created_at: latestRefund.created_at,
        error: null,
      };
    }

    return { error: "No refunds found for this payment" };
  } catch (error) {
    console.error("Razorpay refund fetch error:", error);
    return {
      error:
        error.error?.description ||
        error.message ||
        "Failed to fetch from Razorpay",
    };
  }
};

// Get all refunded orders for admin
exports.getRefundedOrdersForAdmin = async (req, res) => {
  try {
    // Find orders where cancellation exists and has refund information
    const refundedOrders = await Order.find({
      $or: [
        { status: "refunded" },
        { status: "cancelled", "cancellation.refundStatus": { $exists: true } },
        { "payment.status": "refunded" },
        { "payment.status": "partially_refunded" },
      ],
    })
      .populate("userId", "name email phone")
      .sort({ "cancellation.refundedAt": -1, updatedAt: -1 })
      .lean();

    // Categorize orders by their refund status
    const categorizedOrders = {
      pending: [],
      initiated: [],
      completed: [],
      failed: [],
      mismatched: [], // Orders where status doesn't match actual state
    };

    refundedOrders.forEach((order) => {
      const refundStatus = order.cancellation?.refundStatus || "unknown";

      // Check for mismatched status
      // If refundedAt exists but status is not completed
      if (order.cancellation?.refundedAt && refundStatus !== "completed") {
        categorizedOrders.mismatched.push({
          ...order,
          suggestedStatus: "completed",
          issue: "Refund processed but status not updated to completed",
        });
      }
      // If refund failed but order status is still refunded
      else if (refundStatus === "failed" && order.status === "refunded") {
        categorizedOrders.mismatched.push({
          ...order,
          suggestedStatus: "cancelled",
          issue: "Refund failed but order marked as refunded",
        });
      }
      // Otherwise categorize normally
      else if (categorizedOrders[refundStatus]) {
        categorizedOrders[refundStatus].push(order);
      }
    });

    return res.status(200).json({
      success: true,
      message: "Refunded orders fetched successfully",
      data: {
        total: refundedOrders.length,
        categorized: categorizedOrders,
        summary: {
          pending: categorizedOrders.pending.length,
          initiated: categorizedOrders.initiated.length,
          completed: categorizedOrders.completed.length,
          failed: categorizedOrders.failed.length,
          mismatched: categorizedOrders.mismatched.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching refunded orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch refunded orders",
      error: error.message,
    });
  }
};

// Verify refund status from Razorpay before updating
exports.verifyRefundStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the order
    const order = await Order.findOne({
      $or: [{ orderId }, { _id: orderId }],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const paymentId = order.payment?.razorpay?.paymentId;
    const refundId = order.cancellation?.refundId;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "No payment ID found for this order",
      });
    }

    // Fetch refund status from Razorpay
    const razorpayStatus = await fetchRazorpayRefundStatus(paymentId, refundId);

    if (razorpayStatus.error) {
      return res.status(400).json({
        success: false,
        message: "Failed to fetch refund status from Razorpay",
        error: razorpayStatus.error,
        data: {
          orderId: order.orderId,
          currentStatus: order.cancellation?.refundStatus,
          paymentId: paymentId,
          refundId: refundId,
        },
      });
    }

    // Map Razorpay status to our status
    // Razorpay statuses: processed, pending, failed
    let mappedStatus = "pending";
    if (razorpayStatus.status === "processed") {
      mappedStatus = "completed";
    } else if (razorpayStatus.status === "failed") {
      mappedStatus = "failed";
    } else if (razorpayStatus.status === "pending") {
      mappedStatus = "initiated";
    }

    // Check if status matches
    const currentDbStatus = order.cancellation?.refundStatus;
    const isMatched = currentDbStatus === mappedStatus;

    return res.status(200).json({
      success: true,
      message: "Refund status verified from Razorpay",
      data: {
        orderId: order.orderId,
        razorpayStatus: {
          status: razorpayStatus.status,
          mappedStatus: mappedStatus,
          amount: razorpayStatus.amount,
          refundId: razorpayStatus.id,
          createdAt: razorpayStatus.created_at,
          speed: razorpayStatus.speed,
        },
        databaseStatus: {
          refundStatus: currentDbStatus,
          orderStatus: order.status,
          paymentStatus: order.payment?.status,
        },
        isMatched: isMatched,
        needsUpdate: !isMatched,
        suggestedAction: !isMatched
          ? `Update database status from "${currentDbStatus}" to "${mappedStatus}"`
          : "Status is already up to date",
      },
    });
  } catch (error) {
    console.error("Error verifying refund status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify refund status",
      error: error.message,
    });
  }
};

// Update refund status (with Razorpay verification)
exports.updateRefundStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      refundStatus,
      refundAmount,
      refundId,
      refundError,
      notes,
      skipVerification = false, // Option to skip Razorpay verification
    } = req.body;

    // Validate refund status
    const validStatuses = ["pending", "initiated", "completed", "failed"];
    if (!validStatuses.includes(refundStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid refund status. Must be one of: pending, initiated, completed, failed",
      });
    }

    // Find the order
    const order = await Order.findOne({
      $or: [{ orderId }, { _id: orderId }],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify with Razorpay unless skipped
    if (!skipVerification && order.payment?.razorpay?.paymentId) {
      const razorpayStatus = await fetchRazorpayRefundStatus(
        order.payment.razorpay.paymentId,
        order.cancellation?.refundId,
      );

      if (!razorpayStatus.error) {
        // Map Razorpay status
        let razorpayMappedStatus = "pending";
        if (razorpayStatus.status === "processed") {
          razorpayMappedStatus = "completed";
        } else if (razorpayStatus.status === "failed") {
          razorpayMappedStatus = "failed";
        } else if (razorpayStatus.status === "pending") {
          razorpayMappedStatus = "initiated";
        }

        // Check if requested status matches Razorpay
        if (refundStatus !== razorpayMappedStatus) {
          return res.status(400).json({
            success: false,
            message: "Requested status doesn't match Razorpay records",
            data: {
              requestedStatus: refundStatus,
              razorpayStatus: razorpayStatus.status,
              mappedRazorpayStatus: razorpayMappedStatus,
              suggestion: `Razorpay shows status as "${razorpayStatus.status}". Please update to "${razorpayMappedStatus}" instead.`,
            },
          });
        }

        // If Razorpay verification passed, use Razorpay data
        if (!refundId && razorpayStatus.id) {
          req.body.refundId = razorpayStatus.id;
        }
        if (!refundAmount && razorpayStatus.amount) {
          req.body.refundAmount = razorpayStatus.amount;
        }
      } else {
        // Razorpay verification failed but we can still proceed if skipVerification is allowed
        console.warn("Razorpay verification failed:", razorpayStatus.error);
      }
    }

    // Prepare update object
    const updateData = {
      "cancellation.refundStatus": refundStatus,
    };

    // Add optional fields if provided
    if (req.body.refundAmount !== undefined) {
      updateData["cancellation.refundAmount"] = req.body.refundAmount;
    }

    if (req.body.refundId) {
      updateData["cancellation.refundId"] = req.body.refundId;
    }

    if (refundError) {
      updateData["cancellation.refundError"] = refundError;
    }

    // If status is completed, set refundedAt timestamp
    if (refundStatus === "completed" && !order.cancellation?.refundedAt) {
      updateData["cancellation.refundedAt"] = new Date();
      updateData["status"] = "refunded";
      updateData["payment.status"] = "refunded";
    }

    // If status is failed, update order status accordingly
    if (refundStatus === "failed") {
      updateData["status"] = "cancelled";
      updateData["payment.status"] = "failed";
    }

    // Add internal note if provided
    if (notes) {
      updateData["notes.internal"] = order.notes?.internal
        ? `${
            order.notes.internal
          }\n[${new Date().toISOString()}] Refund Update: ${notes}`
        : `[${new Date().toISOString()}] Refund Update: ${notes}`;
    }

    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).populate("userId", "name email phone");

    return res.status(200).json({
      success: true,
      message: "Refund status updated successfully",
      data: updatedOrder,
      verified: !skipVerification,
    });
  } catch (error) {
    console.error("Error updating refund status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update refund status",
      error: error.message,
    });
  }
};

// Sync all refund statuses from Razorpay
exports.syncRefundStatusesFromRazorpay = async (req, res) => {
  try {
    const orders = await Order.find({
      "payment.razorpay.paymentId": { $exists: true },
      $or: [
        { "cancellation.refundStatus": { $in: ["pending", "initiated"] } },
        {
          status: "refunded",
          "cancellation.refundStatus": { $ne: "completed" },
        },
      ],
    });

    const results = {
      total: orders.length,
      updated: 0,
      alreadyUpToDate: 0,
      failed: [],
      details: [],
    };

    for (const order of orders) {
      try {
        const razorpayStatus = await fetchRazorpayRefundStatus(
          order.payment.razorpay.paymentId,
          order.cancellation?.refundId,
        );

        if (razorpayStatus.error) {
          results.failed.push({
            orderId: order.orderId,
            error: razorpayStatus.error,
          });
          continue;
        }

        // Map Razorpay status
        let mappedStatus = "pending";
        if (razorpayStatus.status === "processed") {
          mappedStatus = "completed";
        } else if (razorpayStatus.status === "failed") {
          mappedStatus = "failed";
        } else if (razorpayStatus.status === "pending") {
          mappedStatus = "initiated";
        }

        const currentStatus = order.cancellation?.refundStatus;

        if (currentStatus === mappedStatus) {
          results.alreadyUpToDate++;
          continue;
        }

        // Update the order
        const updateData = {
          "cancellation.refundStatus": mappedStatus,
          "cancellation.refundId": razorpayStatus.id,
          "cancellation.refundAmount": razorpayStatus.amount,
        };

        if (mappedStatus === "completed") {
          updateData["cancellation.refundedAt"] = new Date(
            razorpayStatus.created_at * 1000,
          );
          updateData["status"] = "refunded";
          updateData["payment.status"] = "refunded";
        } else if (mappedStatus === "failed") {
          updateData["status"] = "cancelled";
          updateData["payment.status"] = "failed";
        }

        await Order.findByIdAndUpdate(order._id, { $set: updateData });

        results.updated++;
        results.details.push({
          orderId: order.orderId,
          oldStatus: currentStatus,
          newStatus: mappedStatus,
          razorpayRefundId: razorpayStatus.id,
        });
      } catch (error) {
        results.failed.push({
          orderId: order.orderId,
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Sync completed. Updated ${results.updated} orders.`,
      data: results,
    });
  } catch (error) {
    console.error("Error syncing refund statuses:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync refund statuses",
      error: error.message,
    });
  }
};

// Bulk update refund status for multiple orders
exports.bulkUpdateRefundStatus = async (req, res) => {
  try {
    const { orderIds, refundStatus } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "orderIds must be a non-empty array",
      });
    }

    const validStatuses = ["pending", "initiated", "completed", "failed"];
    if (!validStatuses.includes(refundStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid refund status",
      });
    }

    const updateData = {
      "cancellation.refundStatus": refundStatus,
    };

    if (refundStatus === "completed") {
      updateData["cancellation.refundedAt"] = new Date();
      updateData["status"] = "refunded";
      updateData["payment.status"] = "refunded";
    }

    const result = await Order.updateMany(
      { _id: { $in: orderIds } },
      { $set: updateData },
    );

    return res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} orders`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error in bulk update:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to bulk update refund status",
      error: error.message,
    });
  }
};

// order delievered api
exports.delieverOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status === "cancelled" || order.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Cannot deliver a cancelled or refunded order",
      });
    }

    order.status = "delivered";
    order.shipping.deliveredAt = new Date();
    if (order.payment.method === "cod") {
      order.payment.status = "completed";
      order.payment.paidAt = new Date();
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order marked as delivered successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error marking order as delivered:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark order as delivered",
      error: error.message,
    });
  }
};
// pending payment status in db but payment was done
exports.verifyPendingPayments = async (req, res) => {
  try {
    // Default to 24 hours if not provided
    const { time } = req.body;
    const hoursToCheck = time ? parseInt(time) : 24;

    const cutoffTime = new Date(Date.now() - hoursToCheck * 60 * 60 * 1000);

    // Find pending orders created within the time window that have a razorpay order ID
    const pendingOrders = await Order.find({
      status: "pending",
      "payment.razorpay.orderId": { $exists: true, $ne: null },
      createdAt: { $gte: cutoffTime },
    })
      .populate("userId", "name email phone")
      .lean();

    const mismatchedOrders = [];

    for (const order of pendingOrders) {
      try {
        const razorpayOrderId = order.payment.razorpay.orderId;

        // Fetch payments for this order from Razorpay
        const payments = await razorpay.orders.fetchPayments(razorpayOrderId);

        if (payments && payments.items) {
          // Check for any successful payment (captured or authorized)
          const successfulPayment = payments.items.find(
            (p) => p.status === "captured" || p.status === "authorized",
          );

          if (successfulPayment) {
            mismatchedOrders.push({
              _id: order._id,
              orderId: order.orderId,
              user: order.userId,
              orderTotal: order.pricing?.total,
              dbStatus: order.status,
              dbPaymentStatus: order.payment?.status,
              razorpay: {
                paymentId: successfulPayment.id,
                status: successfulPayment.status,
                amount: successfulPayment.amount / 100, // Razorpay amount is in paise
                createdAt: successfulPayment.created_at
                  ? new Date(successfulPayment.created_at * 1000)
                  : null,
              },
              suggestion:
                "Payment exists in Razorpay but order is pending in DB",
            });
          }
        }
      } catch (rzpError) {
        console.error(
          `Error fetching Razorpay payments for order ${order.orderId}:`,
          rzpError.message,
        );
        // Continue to next order even if one fails
      }
    }

    return res.status(200).json({
      success: true,
      message: `Found ${mismatchedOrders.length} orders with pending status but successful payments in last ${hoursToCheck} hours`,
      data: {
        checkedOrdersCount: pendingOrders.length,
        timeWindowHours: hoursToCheck,
        mismatches: mismatchedOrders,
      },
    });
  } catch (error) {
    console.error("Error verifying pending payments:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify pending payments",
      error: error.message,
    });
  }
};

// Confirm pending payment and update order
exports.confirmPendingPayment = async (req, res) => {
  try {
    const { orderId, paymentId, paymentDate } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    let query = { orderId: orderId };

    // Only check _id if the provided orderId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      query = { $or: [{ orderId }, { _id: orderId }] };
    }

    const order = await Order.findOne(query).populate("userId", "name email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order status
    order.status = "confirmed";
    order.payment.status = "completed";
    order.payment.paidAt = paymentDate ? new Date(paymentDate) : new Date();

    // If payment ID provided and different, update it (optional, mainly for record)
    if (
      paymentId &&
      (!order.payment.razorpay || !order.payment.razorpay.paymentId)
    ) {
      if (!order.payment.razorpay) order.payment.razorpay = {};
      order.payment.razorpay.paymentId = paymentId;
    }

    await order.save();

    // Send confirmation email
    try {
      if (order.userId && order.userId.email) {
        await sendEmail(order.userId.email, "orderConfirmed", {
          userName: order.userId.name,
          orderId: order.orderId,
          orderDate: new Date(order.createdAt).toLocaleDateString(),
          totalAmount: order.pricing.total,
          items: order.items,
          shippingAddress: order.shippingAddress,
        });
      }
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
      // We don't fail the request if email fails, but we log it
    }

    return res.status(200).json({
      success: true,
      message: "Order confirmed and updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error confirming pending payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
      error: error.message,
    });
  }
};
