import type { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../../models/order.js";
import Product from "../../models/product.js";
import Cart from "../../models/cart.js";
import { sendEmail } from "../../lib/nodemailer.js";
import { hashOtp } from "../../lib/jwt.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { enqueue } from "../../lib/jobQueue.js";
import {
  validateAndPriceCart,
  CartValidationError,
} from "../../services/cartValidation.service.js";
import { generateOTP, generatePackageId, type RefundResponse, type OrderItemInput } from "./order.helpers.js";
import {
  handleRefundCreated,
  handleRefundProcessed,
  handleRefundFailed,
  handlePaymentCaptured,
  handlePaymentFailed,
} from "./order.webhook.js";

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID ?? "",
  key_secret: env.RAZORPAY_KEY_SECRET ?? "",
});

// 1. Create Order (from Cart or Direct Purchase)
export const createOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      purchaseType,
      items,
      isPersonalizedName,
      shippingAddress,
      billingAddress,
      notes,
      isGift,
      giftMessage,
      giftWrap,
      isCodAdvance,
      idempotencyKey,
      shippingCharge,
      shippingCourier,
      shippingEtd,
    } = req.body as {
      purchaseType: "cart" | "direct";
      items?: Array<{
        productId: string;
        quantity: number;
        colorId: string;
        variantId?: string;
        sizeId?: string;
      }>;
      isPersonalizedName?: string;
      shippingAddress: {
        fullName: string;
        phone: string;
        email: string;
        area: string;
        street: string;
        city: string;
        state: string;
        pincode: string;
      };
      billingAddress?: Record<string, unknown>;
      notes?: string;
      isGift?: boolean;
      giftMessage?: string;
      giftWrap?: boolean;
      isCodAdvance?: boolean;
      idempotencyKey?: string;
      shippingCharge?: number;
      shippingCourier?: string;
      shippingEtd?: string;
    };

    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // Validate shipping address
    const requiredAddressFields = ["fullName", "phone", "email", "area", "street", "city", "state", "pincode"];
    for (const field of requiredAddressFields) {
      if (!shippingAddress || !shippingAddress[field as keyof typeof shippingAddress]) {
        res.status(400).json({ success: false, message: `Shipping address "${field}" is required` });
        return;
      }
    }

    let validatedItems: Awaited<ReturnType<typeof validateAndPriceCart>>;

    if (purchaseType === "cart") {
      const cart = await Cart.findOne({ user: userId }).lean();

      if (!cart || cart.items.length === 0) {
        res.status(400).json({ success: false, message: "Cart is empty" });
        return;
      }

      validatedItems = await validateAndPriceCart(
        cart.items.map((ci) => ({
          productId: String(ci.product),
          colorId: String(ci.color),
          sizeId: ci.size ? String(ci.size) : undefined,
          quantity: ci.quantity,
        })),
      );
    } else if (purchaseType === "direct") {
      if (!items || items.length === 0) {
        res.status(400).json({ success: false, message: "At least one item is required" });
        return;
      }

      for (const item of items) {
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          res.status(400).json({ success: false, message: "Quantity must be at least 1" });
          return;
        }
      }

      validatedItems = await validateAndPriceCart(items);
    } else {
      res.status(400).json({ success: false, message: "Invalid purchase type" });
      return;
    }

    const orderItems: OrderItemInput[] = validatedItems.map((vi) => ({
      productId: vi.productId,
      colorId: vi.colorId,
      sizeId: vi.sizeId ?? null,
      name: vi.name,
      description: vi.description,
      quantity: vi.quantity,
      isPersonalized: vi.isPersonalized,
      personalizedName: vi.isPersonalized ? (isPersonalizedName ?? null) : null,
      priceAtPurchase: vi.priceAtPurchase,
      subtotal: vi.subtotal,
      addedFrom: purchaseType === "cart" ? "cart" : "direct",
      images: vi.images,
      sku: vi.sku,
      variantName: vi.variantName ?? null,
    }));
    const subtotal = validatedItems.reduce((sum, i) => sum + i.subtotal, 0);

    const discount = isCodAdvance
      ? 0
      : subtotal < env.AUTO_DISCOUNT_THRESHOLD
        ? 0
        : Math.round(subtotal * (env.AUTO_DISCOUNT_PERCENT / 100));

    // ── Shipping charge: prefer frontend-provided charge, else flat default fee ──
    const shipping = shippingCharge ?? env.DEFAULT_SHIPPING_FEE;
    const giftWrapCharges = giftWrap ? env.DEFAULT_GIFT_WRAP_FEE : 0;
    const total = subtotal - discount + shipping + giftWrapCharges;
    const codAdvance = isCodAdvance
      ? Math.max(env.COD_ADVANCE_MIN, Math.round(subtotal * (env.COD_ADVANCE_PERCENT / 100)))
      : 0;

    let orderHash: string | undefined;
    if (idempotencyKey) {
      const cartItemsString = JSON.stringify(orderItems.map(i => ({ product: String(i.productId), quantity: i.quantity })));
      orderHash = crypto.createHash("sha256").update(cartItemsString).digest("hex");

      // An idempotency key represents ONE specific checkout attempt.
      // If a non-terminal order with this key exists AND its payload hash matches,
      // the client is retrying the same network call → return the cached order.
      // If the hash differs, the client is reusing the key with different
      // business data → reject as a 409 (key collision bug, not a legit retry).
      const existingOrder = await Order.findOne({
        idempotencyKey,
        userId,
        status: { $in: ["pending", "payment_failed"] },
      })
        .select("idempotencyHash orderId pricing.total")
        .lean();
      if (existingOrder) {
        if (existingOrder.idempotencyHash && existingOrder.idempotencyHash !== orderHash) {
          res.status(409).json({
            success: false,
            message:
              "Idempotency key reused with a different cart. Generate a new key for each checkout attempt.",
          });
          return;
        }
        res.status(200).json({
          success: true,
          message: "Order already created",
          order: {
            orderId: existingOrder.orderId,
            _id: existingOrder._id,
            total: existingOrder.pricing?.total,
          },
        });
        return;
      }

      // A terminal-status order (confirmed/shipped/delivered/cancelled) already
      // consumed this key. The client must generate a fresh UUID for any new
      // checkout attempt — rejecting stale-key reuse prevents accidental
      // deduplication of a legitimate repeat purchase.
      const terminalOrder = await Order.findOne({
        idempotencyKey,
        userId,
        status: { $nin: ["pending", "payment_failed"] },
      })
        .select("_id")
        .lean();
      if (terminalOrder) {
        res.status(409).json({
          success: false,
          message:
            "This checkout attempt has already completed. Start a new checkout to place another order.",
        });
        return;
      }
    }

    const order = new Order({
      userId,
      purchaseType,
      idempotencyKey,
      idempotencyHash: orderHash,
      items: orderItems,
      pricing: {
        subtotal,
        advance: codAdvance,
        discount: { amount: discount, couponCode: null, couponId: null },
        shipping,
        total,
      },
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      notes: { customer: notes || "" },
      isGift: isGift || false,
      giftMessage: giftMessage || null,
      giftWrap: giftWrap || false,
      giftWrapCharges,
      status: "pending",
      payment: { status: "pending" },
      ...(shippingCourier || shippingEtd
        ? {
            shipping: {
              carrier: shippingCourier || "",
              estimatedDelivery: shippingEtd && !isNaN(Date.parse(shippingEtd)) ? new Date(shippingEtd) : undefined,
            },
          }
        : {}),
    });

    
      await order.save();
   

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: {
        orderId: order.orderId,
        _id: order._id,
        total: order.pricing?.total,
      },
    });

    enqueue("update-profile", {
      userId: req.user!._id.toString(),
      updates: (() => {
        const updates: Record<string, unknown> = {};
        const user = req.user!;
        if (!user.mobile) {
          updates.mobile = Number(shippingAddress.phone);
          updates.isMobileVerified = true;
        }
        if (!user.address) {
          updates.address = {
            pincode: Number(shippingAddress.pincode),
            state: shippingAddress.state,
            city: shippingAddress.city,
            street: shippingAddress.street,
            area: shippingAddress.area,
            instructions: "",
          };
        } else {
          if (!user.address.pincode)
            updates["address.pincode"] = Number(shippingAddress.pincode);
          if (!user.address.state) updates["address.state"] = shippingAddress.state;
          if (!user.address.city) updates["address.city"] = shippingAddress.city;
          if (!user.address.street) updates["address.street"] = shippingAddress.street;
          if (!user.address.area) updates["address.area"] = shippingAddress.area;
        }
        return updates;
      })(),
    });
  } catch (error) {
    if (error instanceof CartValidationError) {
      res.status(409).json({
        success: false,
        message: error.message,
        recoverable: error.recoverable,
        errors: error.items,
        validItems: error.validItems,
      });
      return;
    }
    logger.error(error, "Create Order Error");
    res.status(500).json({
      success: false,
      message: "Failed to create order",           error: "Internal Server Error",
    });
  }
};

// 2. Create Razorpay Order
export const createRazorpayOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { orderId, isCodAdvance } = req.body as {
      orderId: string;
      isCodAdvance?: boolean;
    };
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const order = await Order.findOne({ orderId, userId });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    if (order.status !== "pending") {
      res
        .status(400)
        .json({ success: false, message: "Order is not in pending state" });
      return;
    }

    if (order.payment?.razorpay?.orderId) {
      res.status(200).json({
        success: true,
        razorpayOrderId: order.payment.razorpay.orderId,
        amount: order.pricing?.total,
        currency: "INR",
        keyId: env.RAZORPAY_KEY_ID,
      });
      return;
    }

    const options = {
      amount: isCodAdvance
        ? (order.pricing?.advance ?? 0) * 100
        : (order.pricing?.total ?? 0) * 100,
      currency: "INR",
      receipt: order.orderId,
      notes: {
        orderId: order.orderId,
        userId: userId.toString(),
      },
    };

    if (isCodAdvance && order.payment) {
      order.payment.codAdvance = true;
    }

    const razorpayOrder = await razorpay.orders.create(options);
    if (order.payment) {
      if (!order.payment.razorpay) {
        order.payment.razorpay = { orderId: "" };
      }
      order.payment.razorpay.orderId = razorpayOrder.id;
    }
    await order.save();

    res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: isCodAdvance ? 100 : order.pricing?.total,
      currency: "INR",
      keyId: env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    logger.error(error, "Create Razorpay Order Error");
    res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",           error: "Internal Server Error",
    });
  }
};

// 2.5 Retry Payment for failed orders
export const retryPayment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { orderId } = req.params as { orderId: string };
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const order = await Order.findOne({ orderId, userId });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    if (order.status !== "payment_failed" && order.status !== "pending") {
      res.status(400).json({
        success: false,
        message: `Order is in '${order.status}' state. Cannot retry payment.`,
      });
      return;
    }

    // Check if a prior Razorpay payment was actually captured but our callback didn't process it
    if (order.payment?.razorpay?.paymentId) {
      try {
        const existingPayment = await razorpay.payments.fetch(
          order.payment.razorpay.paymentId,
        ) as { status: string };
        if (existingPayment.status === "captured" || existingPayment.status === "authorized") {
          order.status = "confirmed";
          if (order.payment) {
            order.payment.status = "completed";
            order.payment.verified = true;
            order.payment.transactionId = order.payment.razorpay.paymentId;
            order.payment.paidAt = new Date();
          }
          await order.save();

          // Deduct stock (verifyPayment never completed, so stock wasn't deducted)
          await Promise.all(
            order.items.map((item) =>
              Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity },
              }),
            ),
          );

          enqueue("send-email", {
            to: order.shippingAddress?.email ?? "",
            template: "orderConfirmed",
            data: {
              orderId: order.orderId,
              packageId: order.packageId,
              orderDate: new Date().toLocaleString(),
              customerName: order.shippingAddress?.fullName || "Customer",
              orderTotal: order.pricing?.total,
              subtotal: order.pricing?.subtotal,
              discount: order.pricing?.discount?.amount || 0,
              shipping: order.pricing?.shipping,
              total: order.pricing?.total,
              deliveryOTP: "...",
              contactEmail: env.MY_GMAIL,
              items: order.items,
              shippingAddress: order.shippingAddress,
              billingAddress: order.billingAddress || order.shippingAddress,
              paymentMethod: "Online Payment",
            },
          });

          res.status(200).json({
            success: true,
            alreadyPaid: true,
            message: "Payment already completed",
            orderId: order.orderId,
          });
          return;
        }
      } catch (rzpError) {
        logger.warn(rzpError, "Razorpay fetch failed for existing payment, continuing with retry");
      }
    }

    // Reset order status to pending and clear old razorpay order ID
    order.status = "pending";
    if (order.payment) {
      order.payment.status = "pending";
      if (order.payment.razorpay) {
        order.payment.razorpay.orderId = "";
      }
    }
    await order.save();

    // Create new Razorpay order
    const options = {
      amount: (order.pricing?.total ?? 0) * 100,
      currency: "INR",
      receipt: order.orderId,
      notes: {
        orderId: order.orderId,
        userId: userId.toString(),
      },
    };

    const razorpayOrder = await razorpay.orders.create(options);
    if (order.payment) {
      if (!order.payment.razorpay) {
        order.payment.razorpay = { orderId: "" };
      }
      order.payment.razorpay.orderId = razorpayOrder.id;
    }
    await order.save();

    res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: order.pricing?.total,
      currency: "INR",
      keyId: env.RAZORPAY_KEY_ID,
      orderId: order.orderId,
    });
  } catch (error) {
    logger.error(error, "Retry Payment Error");
    res.status(500).json({
      success: false,
      message: "Failed to retry payment",
      error: "Internal Server Error",
    });
  }
};

// 3. Verify Payment (MOST CRITICAL)
export const verifyPayment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } =
      req.body as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        orderId: string;
      };

    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const order = await Order.findOne({ orderId, userId }).populate(
      "items.productId",
    );
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    const generatedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET ?? "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const sigVerified = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, "hex"),
      Buffer.from(razorpay_signature, "hex"),
    );
    if (!sigVerified) {
      order.status = "payment_failed";
      if (order.payment) {
        order.payment.status = "failed";
      }
      await order.save();

      await sendEmail(order.shippingAddress?.email ?? "", "paymentFailed", {
        orderId: order.orderId,
        customerName: order.shippingAddress?.fullName || "Customer",
        orderTotal: `₹${order.pricing?.total}`,
        contactEmail: env.MY_GMAIL,
      }).catch((err) =>
        logger.error(err, "Failed to send payment failure email"),
      );

      res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
      return;
    }

    // O9: Before processing, verify the payment is actually captured on Razorpay
    let razorpayPaymentState: { status: string } | null = null;
    try {
      razorpayPaymentState = await razorpay.payments.fetch(
        razorpay_payment_id,
      ) as { status: string };
    } catch {
      // If fetch fails, continue with normal flow — the signature check already passed
      logger.warn({ razorpay_payment_id }, "Razorpay payment fetch failed, continuing with signature verification only");
    }
    if (razorpayPaymentState && razorpayPaymentState.status !== "captured" && razorpayPaymentState.status !== "authorized") {
      res.status(400).json({ success: false, message: "Payment not captured" });
      return;
    }

    const razorpayOrderDetails = await razorpay.orders.fetch(razorpay_order_id);

    // P6: Verify the Razorpay order's notes.orderId matches our order
    const rzpNotes = (razorpayOrderDetails as { notes?: Record<string, string> }).notes;
    if (rzpNotes?.["orderId"] !== order.orderId) {
      res.status(400).json({ success: false, message: "Amount mismatch" });
      return;
    }

    // P3: Always validate amount — for COD-advance check against the advance, for full payment check total
    const expectedAmount = order.payment?.codAdvance
      ? (order.pricing?.advance ?? 0) * 100
      : (order.pricing?.total ?? 0) * 100;

    if (razorpayOrderDetails.amount !== expectedAmount) {
      res.status(400).json({ success: false, message: "Amount mismatch" });
      return;
    }

    order.status = "confirmed";
    if (order.payment) {
      order.payment.status = !order.payment.codAdvance
        ? "completed"
        : "cod-advance";
      order.payment.verified = true;
      if (!order.payment.razorpay) {
        order.payment.razorpay = {};
      }
      order.payment.razorpay.paymentId = razorpay_payment_id;
      order.payment.razorpay.signature = razorpay_signature;
      order.payment.transactionId = razorpay_payment_id;
      order.payment.paidAt = new Date();
    }

    const deliveryOTP = generateOTP();
    if (!order.notes) {
      order.notes = {};
    }
    // P18: Store OTP hash — not plaintext
    order.notes.internal = `Delivery OTP hash: ${hashOtp(deliveryOTP)}`;

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

    const failedIndex = stockResults.findIndex((r) => !r);
    if (failedIndex !== -1) {
      const restorePromises = stockResults
        .slice(0, failedIndex)
        .map((_, i) =>
          Product.findByIdAndUpdate(order.items[i]!.productId, {
            $inc: { stock: order.items[i]!.quantity },
          }),
        );
      await Promise.all(restorePromises);

      res.status(409).json({
        success: false,
        message: `Insufficient stock for item: ${order.items[failedIndex]!.name}`,
      });
      return;
    }

    if (order.purchaseType === "cart") {
      await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [] } },
      );
    }

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

    enqueue("send-email", {
      to: order.shippingAddress?.email ?? "",
      template: "orderConfirmed",
      data: {
        orderId: order.orderId,
        packageId,
        orderDate: new Date().toLocaleString(),
        customerName: order.shippingAddress?.fullName || "Customer",
        orderTotal: order.pricing?.total,
        subtotal: order.pricing?.subtotal,
        discount: order.pricing?.discount?.amount || 0,
        shipping: order.pricing?.shipping,
        total: order.pricing?.total,
        deliveryOTP,
        contactEmail: env.MY_GMAIL,
        items: order.items,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress || order.shippingAddress,
        paymentMethod: "Online Payment",
      },
    });
  } catch (error) {
    logger.error(error, "Verify Payment Error");
    res.status(500).json({
      success: false,
      message: "Payment verification failed",           error: "Internal Server Error",
    });
  }
};

// 5. Get User Orders
export const getUserOrders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const status = req.query.status as string | undefined;
    const page = req.query.page as string | undefined ?? "1";
    const limit = req.query.limit as string | undefined ?? "10";

    const query: Record<string, unknown> = { userId };
    if (status) query.status = status;

    const pageNum = Number(page);
    const limitNum = Math.min(Number(limit), 100);

    const orders = await Order.find(query)
      .sort({ createdAt: -1 }) // TODO: frontend OrderData uses createdAt for display
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .populate("items.productId", "name images slug")
      .lean();

    const count = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      orders,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
      totalOrders: count,
    });
  } catch (error) {
    logger.error(error, "Get User Orders Error");
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",           error: "Internal Server Error",
    });
  }
};

// 6. Get Single Order
export const getOrderById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const order = await Order.findOne({ orderId, userId })
      .populate("items.productId", "name images slug")
      .select("-payment.razorpay.signature") // TODO: frontend OrderData uses createdAt, updatedAt for display
      .populate("items.colorId", "name code")
      .populate("items.sizeId", "name value")
      .lean();

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    logger.error(error, "Get Order Error");
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",           error: "Internal Server Error",
    });
  }
};

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const filter: { orderId: string; userId?: string } = { orderId: String(orderId) };
    if (req.user?.role !== "admin" && req.user?.role !== "delivery") {
      filter.userId = userId;
    }

    const order = await Order.findOne(filter)
      .populate("items.productId", "name images slug")
      .populate("items.colorId", "name code")
      .populate("items.sizeId", "name value")
      .select("-payment.razorpay.signature") // TODO: frontend OrderData uses createdAt, updatedAt for display
      .lean();

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    res.status(200).json({ success: true, order });
  } catch (error) {
    logger.error(error, "Get Order Error");
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",           error: "Internal Server Error",
    });
  }
};

// 7. Cancel Order
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body as { reason?: string };
    if (!orderId) {
      res.status(400).json({ success: false, message: "Order ID is required" });
      return;
    }
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const order = await Order.findOne({ orderId, userId });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    // Allow cancellation for pending (unpaid) and confirmed (paid but not yet shipped) orders
    const cancellableStatuses = ["pending", "confirmed"];
    if (!cancellableStatuses.includes(order.status)) {
      res.status(400).json({ success: false, message: "Order cannot be cancelled in its current state" });
      return;
    }

    const orderCreatedAt = new Date(order.createdAt);
    const currentTime = new Date();
    const timeDifference = currentTime.getTime() - orderCreatedAt.getTime();
    const twelveHoursInMs = 12 * 60 * 60 * 1000;

    // 12-hour window only applies to paid/confirmed orders — pending (unpaid) orders can always be cancelled
    if (
      order.status === "confirmed" &&
      timeDifference > twelveHoursInMs
    ) {
      res.status(400).json({
        success: false,
        message: "Order can only be cancelled within 12 hours of placement",
      });
      return;
    }

    order.status = "cancelled";
    order.cancellation = {
      reason,
      cancelledBy: "customer",
      cancelledAt: new Date(),
    };

    if (order.payment?.status !== "pending") {
      const refundAmount = order.payment?.codAdvance
        ? (order.pricing?.advance ?? 0)
        : (order.pricing?.total ?? 0);

      // O12: Validate refundAmount > 0 before calling Razorpay
      if (refundAmount <= 0) {
        logger.warn({ orderId: order.orderId }, "Refund skipped — amount is 0 or negative");
      } else {
      try {
        // O9: Fetch Razorpay payment state before issuing refund
        // Validate the stored ID before calling the API — stale/garbage IDs (e.g.
        // from migrated data or a different key) make Razorpay return a 400.
        const paymentId = order.payment?.razorpay?.paymentId;
        if (paymentId && !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
          logger.warn(
            { orderId: order.orderId, paymentId },
            "Refund skipped — stored Razorpay payment ID is invalid",
          );
        } else if (paymentId) {
          try {
            const rzpPayment = await razorpay.payments.fetch(paymentId) as { status?: string };
            if (rzpPayment.status !== "captured") {
              logger.warn({ orderId: order.orderId }, "Refund skipped — payment not captured");
            } else {
        const refundResponse = await razorpay.payments.refund(
          order.payment?.razorpay?.paymentId ?? "",
          {
            amount: refundAmount * 100,
            notes: { orderId: order.orderId, reason: reason ?? null },
          },
        );
        const refundResult = refundResponse as RefundResponse;

        order.cancellation = {
          ...order.cancellation,
          refundStatus: "initiated",
          refundId: refundResult.id,
          refundAmount,
        };
            }
          } catch (rzpError) {
            logger.warn({ orderId: order.orderId, paymentId }, "Razorpay payment fetch failed; refund skipped — payment ID is not valid on this account");
          }
        }
      } catch (error) {
        logger.error(error, "Refund initiation failed");
        order.cancellation = {
          ...order.cancellation,
          refundStatus: "failed",
          refundError: error instanceof Error ? error.message : "Unknown error",
        };
      }
      }
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });

    (async () => {
      try {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity },
          });
        }
      } catch (stockError) {
        logger.error(stockError, "Failed to restore stock");
      }
    })();

    sendEmail(order.shippingAddress?.email ?? "", "orderCancelled", {
      user: {
        name: order.shippingAddress?.fullName ?? "Customer",
        email: order.shippingAddress?.email ?? "",
      },
      order: {
        _id: order._id,
        orderId: order.orderId,
        createdAt: order.createdAt,
        pricing: order.pricing,
        cancellation: order.cancellation,
        shippingAddress: order.shippingAddress,
        pendingStatus: !!order.payment?.status,
      },
    }).catch((emailError) => {
      logger.error(emailError, "Failed to send cancellation email");
    });
  } catch (error) {
    logger.error(error, "Cancel Order Error");
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",           error: "Internal Server Error",
    });
  }
};

// 8. Verify Delivery OTP
export const verifyDeliveryOTP = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { orderId, otp } = req.body as { orderId: string; otp: string };

    const order = await Order.findOne({ orderId });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    if (order.status !== "shipped") {
      res
        .status(400)
        .json({ success: false, message: "Order cannot be marked as delivered" });
      return;
    }

    const storedHash =
      order.notes?.internal?.match(/Delivery OTP hash: ([a-f0-9]{64})/)?.[1];

    if (!storedHash || storedHash !== hashOtp(otp)) {
      res.status(400).json({ success: false, message: "Invalid OTP" });
      return;
    }

    order.status = "delivered";
    if (order.shipping) {
      order.shipping.deliveredAt = new Date();
    }
    if (order.payment?.method === "cod") {
      order.payment.status = "completed";
      order.payment.paidAt = new Date();
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order delivered successfully",
    });

    sendEmail(order.shippingAddress?.email ?? "", "orderDelivered", {
      user: {
        name: order.shippingAddress?.fullName ?? "Customer",
        email: order.shippingAddress?.email ?? "",
      },
      order: {
        _id: order._id,
        orderId: order.orderId,
        shipping: order.shipping,
        shippingAddress: order.shippingAddress,
        items: order.items,
        totalAmount: order.pricing?.total,
      },
    }).catch((emailError) => {
      logger.error(emailError, "Failed to send delivery confirmation email");
    });
  } catch (error) {
    logger.error(error, "Verify OTP Error");
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",           error: "Internal Server Error",
    });
  }
};

export const markToShipped = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { orderId } = req.body as { orderId: string };
    const order = await Order.findOne({ orderId });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    if (order.status !== "confirmed") {
      res
        .status(400)
        .json({ success: false, message: "Order cannot be marked as shipped" });
      return;
    }

    order.status = "shipped";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order marked as shipped successfully",
    });

    sendEmail(order.shippingAddress?.email ?? "", "orderShipped", {
      user: {
        name: order.shippingAddress?.fullName ?? "Customer",
        email: order.shippingAddress?.email ?? "",
      },
      order: { _id: order._id, orderId: order.orderId },
    }).catch((emailError) => {
      logger.error(emailError, "Failed to send shipping email");
    });
  } catch (error) {
    logger.error(error, "Mark to Shipped Error");
    res.status(500).json({
      success: false,
      message: "Failed to mark order as shipped",           error: "Internal Server Error",
    });
  }
};

export const sendDeliveryOTP = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { orderId } = req.body as { orderId: string };
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const filter: { orderId: string; userId?: string } = { orderId: String(orderId) };
    if (req.user?.role !== "admin" && req.user?.role !== "delivery") {
      filter.userId = userId;
    }

    const order = await Order.findOne(filter).lean();
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    // sendDeliveryOTP generates a fresh OTP so it works with our hashed storage
    const newOTP = generateOTP();

    try {
      // Update the stored hash (replaces old one — the old OTP is no longer valid)
      await Order.updateOne(
        { orderId },
        { $set: { "notes.internal": `Delivery OTP hash: ${hashOtp(newOTP)}` } },
      );

      sendEmail(order.shippingAddress?.email ?? "", "orderDeliveryOTP", {
        user: {
          name: order.shippingAddress?.fullName ?? "Customer",
          email: order.shippingAddress?.email ?? "",
        },
        order: { orderId: order.orderId, _id: order._id },
        otp: newOTP,
      });
    } catch (emailError) {
      logger.error(emailError, "Failed to send delivery OTP email");
    }

    res.status(200).json({
      success: true,
      message: "Delivery OTP sent successfully",
    });
  } catch (error) {
    logger.error(error, "Send Delivery OTP Error");
    res.status(500).json({
      success: false,
      message: "Failed to send delivery OTP",           error: "Internal Server Error",
    });
  }
};

export const getAllOrders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = req.user?._id;
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  if (req.user?.role !== "admin") {
    res.status(403).json({ success: false, message: "Forbidden" });
    return;
  }

  const query: Record<string, unknown> = {};
  if (typeof req.body?.status === "string" && req.body.status) {
    query.status = req.body.status;
  }
  try {
    const orders = await Order.find(query)
      .sort({ createdAt: -1 }) // TODO: frontend OrderData uses createdAt, updatedAt for display
      .populate("items.productId", "name images slug")
      .populate("items.colorId", "name")
      .populate("items.sizeId", "name value")
      .select("-payment.razorpay.signature")
      .lean();

    res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    logger.error(error, "Get All Orders Error");
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",           error: "Internal Server Error",
    });
  }
};

// Webhook handler — note the route uses express.raw so req.body is a Buffer
export const handleWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? (req.body as Buffer).toString("utf8")
          : JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (!signature) {
      res.status(400).json({ error: "Missing signature" });
      return;
    }

    const sigVerified = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex"),
    );
    if (!sigVerified) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const eventPayload =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : Buffer.isBuffer(req.body)
          ? JSON.parse((req.body as Buffer).toString("utf8"))
          : req.body;
    const event = eventPayload?.event;
    const payload = eventPayload?.payload?.refund?.entity;

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
      case "payment.captured":
        await handlePaymentCaptured(eventPayload?.payload?.payment?.entity);
        break;
      case "order.paid":
        // order.paid has payload.order.entity (different structure) — log for audit
        logger.info({ event, orderId: eventPayload?.payload?.order?.entity?.id }, "order.paid webhook received");
        break;
      case "payment.failed":
        await handlePaymentFailed(eventPayload?.payload?.payment?.entity);
        break;
      default:
        logger.info({ event }, "Unhandled webhook event");
        break;
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    logger.error(error, "Webhook Error");
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

export const confirmCODOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { orderId } = req.body as { orderId: string };
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const order = await Order.findOne({ orderId, userId }).populate(
      "items.productId",
    );
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    // O3: Stock validation before confirming COD order
    for (const item of order.items) {
      const product = item.productId as unknown as { _id: string; name: string; stock: number } | null;

      if (!product) {
        res.status(400).json({
          success: false,
          message: "Product in order not found",
        });
        return;
      }

      if (product.stock < item.quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`,
        });
        return;
      }
    }

    if (!order.payment) {
      order.payment = {
        method: "cod",
        status: "pending",
        verified: false,
        codAdvance: false,
        codCharges: 0,
      };
    }
    order.payment.method = "cod";
    order.payment.status = "pending";
    order.payment.verified = true;
    order.status = "confirmed";

    order.statusHistory.push({
      status: "confirmed",
      timestamp: new Date(),
      note: "Order confirmed with Cash on Delivery",
      updatedBy: userId,
    });

    const deliveryOTP = generateOTP();
    if (!order.notes) {
      order.notes = {};
    }
    // P18: Store OTP hash — not plaintext
    order.notes.internal = `Delivery OTP hash: ${hashOtp(deliveryOTP)}`;
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

    const failedIndex = stockResults.findIndex((r) => !r);
    if (failedIndex !== -1) {
      const restorePromises = stockResults
        .slice(0, failedIndex)
        .map((_, i) =>
          Product.findByIdAndUpdate(order.items[i]!.productId, {
            $inc: { stock: order.items[i]!.quantity },
          }),
        );
      await Promise.all(restorePromises);

      res.status(409).json({
        success: false,
        message: `Insufficient stock for item: ${order.items[failedIndex]!.name}`,
      });
      return;
    }

    if (order.purchaseType === "cart") {
      await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [] } },
      );
    }

    res.status(200).json({
      success: true,
      message: "COD order confirmed successfully",
      order: {
        orderId: order.orderId,
        status: order.status,
        deliveryOTP,
        packageId,
      },
    });

    enqueue("send-email", {
      to: order.shippingAddress?.email ?? "",
      template: "orderConfirmed",
      data: {
        orderId: order.orderId,
        packageId,
        orderDate: new Date().toLocaleString(),
        customerName: order.shippingAddress?.fullName || "Customer",
        orderTotal: order.pricing?.total,
        subtotal: order.pricing?.subtotal,
        discount: order.pricing?.discount?.amount || 0,
        shipping: order.pricing?.shipping,
        total: order.pricing?.total,
        deliveryOTP,
        contactEmail: env.MY_GMAIL,
        items: order.items,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress || order.shippingAddress,
        paymentMethod: "Cash on Delivery (COD)",
      },
    });
  } catch (error) {
    logger.error(error, "COD Order Confirmation Error");
    res.status(500).json({
      success: false,
      message: "Failed to confirm COD order",           error: "Internal Server Error",
    });
  }
};

// ── Stuck payment recovery ─────────────────────────────────────────
// Scans all "pending" orders that have a Razorpay order ID, checks
// Razorpay's server for actual payment status, and auto-confirms any
// that were captured but our webhook/callback missed.

export const syncStuckPayments = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Find all orders stuck in "pending" with a Razorpay order ID
    const stuckOrders = await Order.find({
      status: "pending",
      "payment.razorpay.orderId": { $exists: true, $ne: "" },
    })
      .select("orderId payment.razorpay status pricing.total createdAt")
      .lean();

    const report = {
      scanned: stuckOrders.length,
      fixed: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as Array<{ orderId: string; status: string; paymentId?: string }>,
    };

    for (const order of stuckOrders) {
      const razorpayOrderId = order.payment?.razorpay?.orderId;
      if (!razorpayOrderId) {
        report.skipped++;
        continue;
      }

      try {
        // Fetch all payments for this Razorpay order
        const response = await razorpay.orders.fetchPayments(
          razorpayOrderId,
        ) as { items?: Array<{ id: string; status: string; amount: number }> };

        const payments = response?.items || [];
        const capturedPayment = payments.find(
          (p) => p.status === "captured",
        );

        if (!capturedPayment) {
          report.skipped++;
          report.details.push({
            orderId: order.orderId,
            status: "no_captured_payment",
          });
          continue;
        }

        // Update order to confirmed
        await Order.updateOne(
          { _id: order._id },
          {
            $set: {
              status: "confirmed",
              "payment.status": "completed",
              "payment.verified": true,
              "payment.method": "razorpay",
              "payment.razorpay.paymentId": capturedPayment.id,
              "payment.transactionId": capturedPayment.id,
              "payment.paidAt": new Date(),
              packageId: generatePackageId(),
            },
          },
        );

        // Deduct stock (was never deducted since the webhook/callback failed)
        const fullOrder = await Order.findOne({ _id: order._id }).select("items").lean();
        if (fullOrder?.items) {
          await Promise.all(
            fullOrder.items.map((item) =>
              Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity },
              }),
            ),
          );
        }

        report.fixed++;
        report.details.push({
          orderId: order.orderId,
          status: "confirmed",
          paymentId: capturedPayment.id,
        });

        logger.info(
          { orderId: order.orderId, razorpayPaymentId: capturedPayment.id },
          "Stuck payment recovered via sync endpoint",
        );
      } catch (err) {
        report.failed++;
        const msg = err instanceof Error ? err.message : "Unknown error";
        report.errors.push(`Order ${order.orderId}: ${msg}`);
        logger.error({ err, orderId: order.orderId }, "syncStuckPayments: failed to process order");
      }
    }

    res.status(200).json({
      success: true,
      message: `Scanned ${report.scanned} stuck orders, fixed ${report.fixed}`,
      data: report,
    });
  } catch (error) {
    logger.error(error, "syncStuckPayments error");
    res.status(500).json({
      success: false,
      message: "Failed to sync stuck payments",
      error: "Internal Server Error",
    });
  }
};

export const cancelOrderByAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { orderId, reason } = req.body as {
    orderId: string;
    reason?: string;
  };
  try {
    const order = await Order.findOne({ orderId });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    // ── Step 1: Handle refund if payment was made ──
    if (order.payment?.status !== "pending") {
      const refundAmount = order.pricing?.total ?? 0;

      if (refundAmount <= 0) {
        logger.warn({ orderId: order.orderId }, "Admin cancel: refund skipped — amount is 0");
      } else {
        try {
          const paymentId = order.payment?.razorpay?.paymentId;
          if (paymentId && !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
            logger.warn(
              { orderId: order.orderId, paymentId },
              "Admin cancel: refund skipped — stored Razorpay payment ID is invalid",
            );
          } else if (paymentId) {
            try {
              const rzpPayment = await razorpay.payments.fetch(paymentId) as { status?: string };
              if (rzpPayment.status !== "captured") {
                logger.warn({ orderId: order.orderId }, "Admin cancel: refund skipped — payment not captured");
              } else {
                const refundResponse = await razorpay.payments.refund(
                  paymentId,
                  {
                    amount: refundAmount * 100,
                    notes: { orderId: order.orderId, reason: reason ?? null },
                  },
                );
                const refundResult = refundResponse as RefundResponse;

                order.cancellation = {
                  ...(order.cancellation ?? {}),
                  refundStatus: "initiated",
                  refundId: refundResult.id,
                  refundAmount,
                };
              }
            } catch (rzpError) {
              logger.warn({ orderId: order.orderId, paymentId }, "Razorpay payment fetch failed; refund skipped — payment ID is not valid on this account");
            }
          }
        } catch (error) {
          logger.error(error, "Refund initiation failed");
          order.cancellation = {
            ...(order.cancellation ?? {}),
            refundStatus: "failed",
            refundError: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }
    }

    // ── Step 2: Restore stock ──
    try {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity },
        });
      }
    } catch (stockError) {
      logger.error(stockError, "Failed to restore stock during admin cancel");
    }

    // ── Step 3: Update local order status ──
    order.status = "cancelled";
    order.cancellation = {
      ...(order.cancellation ?? {}),
      reason,
      cancelledBy: "admin",
      cancelledAt: new Date(),
    };
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
    });

    sendEmail(order.shippingAddress?.email ?? "", "orderCancelled", {
      user: {
        name: order.shippingAddress?.fullName ?? "Customer",
        email: order.shippingAddress?.email ?? "",
      },
      order: {
        _id: order._id,
        orderId: order.orderId,
        createdAt: order.createdAt,
        pricing: order.pricing,
        cancellation: order.cancellation,
        shippingAddress: order.shippingAddress,
        pendingStatus: !!order.payment?.status,
        adminReason: reason,
      },
    }).catch((emailError) => {
      logger.error(emailError, "Failed to send cancellation email");
    });
  } catch (error) {
    logger.error(error, "Cancel Order Error");
    res.status(500).json({
      success: false,
      message: "Failed to cancel order", error: "Internal Server Error",
    });
  }
};
