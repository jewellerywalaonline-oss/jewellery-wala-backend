import Order from "../../models/order.js";
import Product from "../../models/product.js";
import { sendEmail } from "../../lib/nodemailer.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { enqueue } from "../../lib/jobQueue.js";
import { generatePackageId } from "./order.helpers.js";

export async function handleRefundProcessed(refundData: { id: string }): Promise<void> {
  const order = await Order.findOne({ "cancellation.refundId": refundData.id });
  if (order && order.cancellation) {
    order.cancellation.refundStatus = "completed";
    order.cancellation.refundedAt = new Date();
    await order.save();
    sendEmail(order.shippingAddress?.email ?? "", "RefundProcessed", {
      user: { name: order.shippingAddress?.fullName ?? "Customer", email: order.shippingAddress?.email ?? "" },
      order: { _id: order._id, orderId: order.orderId, createdAt: order.createdAt, pricing: order.pricing, cancellation: order.cancellation, shippingAddress: order.shippingAddress, pendingStatus: !!order.payment?.status },
    }).catch((err) => logger.error(err, "Failed to send refund processed email"));
  }
}

export async function handleRefundFailed(refundData: { id: string; error_description?: string }): Promise<void> {
  const order = await Order.findOne({ "cancellation.refundId": refundData.id });
  if (order && order.cancellation) {
    order.cancellation.refundStatus = "failed";
    order.cancellation.refundError = refundData.error_description;
    await order.save();
  }
}

export async function handlePaymentCaptured(paymentEntity: Record<string, unknown> | null | undefined): Promise<void> {
  if (!paymentEntity?.order_id) return;
  try {
    const razorpayOrderId = paymentEntity.order_id as string;
    const razorpayPaymentId = paymentEntity.id as string;
    const order = await Order.findOne({ "payment.razorpay.orderId": razorpayOrderId });
    if (!order || order.status !== "pending") return;
    if (order.payment?.razorpay?.paymentId === razorpayPaymentId) return;

    order.status = "confirmed";
    if (order.payment) {
      order.payment.status = "completed";
      order.payment.verified = true;
      order.payment.method = "razorpay";
      if (!order.payment.razorpay) order.payment.razorpay = {};
      order.payment.razorpay.paymentId = razorpayPaymentId;
      order.payment.transactionId = razorpayPaymentId;
      order.payment.paidAt = new Date();
    }

    const packageId = generatePackageId();
    order.packageId = packageId;
    await order.save();

    const stockResults = await Promise.all(
      order.items.map((item) =>
        Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true, projection: { _id: 1 } },
        ),
      ),
    );
    const failedIdx = stockResults.findIndex((r) => !r);
    if (failedIdx !== -1) {
      logger.warn({ orderId: order.orderId, item: order.items[failedIdx]?.name }, "Stock deduction failed for some items during webhook auto-confirm");
    }

    enqueue("send-email", {
      to: order.shippingAddress?.email ?? "",
      template: "orderConfirmed",
      data: {
        orderId: order.orderId, packageId, orderDate: new Date().toLocaleString(),
        customerName: order.shippingAddress?.fullName || "Customer", orderTotal: order.pricing?.total,
        subtotal: order.pricing?.subtotal, discount: order.pricing?.discount?.amount || 0, shipping: order.pricing?.shipping,
        total: order.pricing?.total, deliveryOTP: "...", contactEmail: env.MY_GMAIL,
        items: order.items, shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress || order.shippingAddress, paymentMethod: "Online Payment",
      },
    });
    logger.info({ orderId: order.orderId, razorpayPaymentId }, "Order auto-confirmed via payment.captured webhook");
  } catch (err) {
    logger.error(err, "Failed to handle payment.captured webhook");
  }
}

export async function handlePaymentFailed(paymentEntity: { id?: string; description?: string; error_description?: string; order_id?: string } | null): Promise<void> {
  if (!paymentEntity?.order_id) return;
  try {
    const order = await Order.findOne({ "payment.razorpay.paymentId": paymentEntity.id });
    if (order && order.status === "pending") {
      order.status = "payment_failed";
      if (order.payment) order.payment.status = "failed";
      await order.save();
    }
  } catch (err) {
    logger.error(err, "Failed to handle payment.failed webhook");
  }
}

export async function handleRefundCreated(refundData: { id: string }): Promise<void> {
  const order = await Order.findOne({ "cancellation.refundId": refundData.id });
  if (order && order.cancellation) {
    order.cancellation.refundStatus = "initiated";
    await order.save();
    sendEmail(order.shippingAddress?.email ?? "", "orderCancelled", {
      user: { name: order.shippingAddress?.fullName ?? "Customer", email: order.shippingAddress?.email ?? "" },
      order: { _id: order._id, orderId: order.orderId, createdAt: order.createdAt, pricing: order.pricing, cancellation: order.cancellation, shippingAddress: order.shippingAddress, pendingStatus: true, paymentRefundStatus: order.cancellation.refundStatus },
    }).catch((emailError) => logger.error(emailError, "Failed to send cancellation email"));
  }
}
