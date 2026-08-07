import type { Request, Response } from "express";
import mongoose from "mongoose";
import Cart from "../../models/cart.js";
import Product from "../../models/product.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { success, fail } from "../../utils/responses.js";
import { logger } from "../../lib/logger.js";
import { withOptionalTransaction } from "../../lib/transactions.js";

// Get user's cart
export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const cart = await Cart.findOne({ user: userId })
    .populate("items.product")
    .populate("items.color")
    .populate("items.size")
    .lean();

  if (!cart || cart.items.length === 0) {
    return success(
      res,
      { items: [], totalItems: 0, totalPrice: 0 },
      "Your cart is empty",
    );
  }

  let totalItems = 0;
  let totalPrice = 0;

  const items = await Promise.all(
    cart.items.map(async (item) => {
      const product = await Product.findById(item.product)
        .select("name price discount_price image images slug stock")
        .lean();
      if (!product) return null;
      const itemTotal =
        product.discount_price > 0
          ? product.discount_price * item.quantity
          : product.price * item.quantity;

      totalItems += item.quantity;
      totalPrice += itemTotal;

      return {
        _id: item._id,
        product: {
          _id: product._id,
          name: product.name,
          price: product.price,
          discount_price: product.discount_price,
          image: product.image ?? null,
          slug: product.slug,
          stock: product.stock,
        },
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        itemTotal,
      } as { color: unknown; size: unknown; quantity: number; itemTotal: number };
    }),
  );

  return success(
    res,
    {
      items: items.filter((i) => i !== null),
      totalItems,
      totalPrice: parseFloat(totalPrice.toFixed(2)),
    },
    "Cart retrieved successfully",
  );
});

// Add item to cart
export const addToCart = asyncHandler(async (req: Request, res: Response) => {
  try {
    return await withOptionalTransaction(async (session) => {
      const { productId, quantity = 1, colorId, sizeId } = req.body as {
        productId?: string;
        quantity?: number;
        colorId?: string;
        sizeId?: string;
      };
      const userId = req.user?._id;

      if (!productId) {
        return fail(res, "Product ID is required", 400);
      }

      const product = await Product.findOne({
        _id: productId,
        status: "active",
        deletedAt: null,
      })
        .select("stock")
        .session(session)
        .lean();

      if (!product) {
        return fail(res, "Product not found or not available", 404);
      }

      if (product.stock < (quantity ?? 1)) {
        return fail(res, "Insufficient stock", 400, { availableStock: product.stock });
      }

      let cart = await Cart.findOne({ user: userId }).session(session);
      if (!cart) {
        cart = new Cart({ user: userId, items: [] });
      }

      const existingItemIndex = cart.items.findIndex((item) => {
        const sameProduct = String(item.product) === productId;
        const sameColor = colorId
          ? String(item.color) === colorId
          : !item.color;
        const sameSize = sizeId
          ? String(item.size) === sizeId
          : !item.size;
        return sameProduct && sameColor && sameSize;
      });

      const newQty = existingItemIndex > -1
        ? (cart.items[existingItemIndex]?.quantity ?? 0) + (quantity ?? 1)
        : (quantity ?? 1);

      if (product.stock < newQty) {
        return fail(res, "Insufficient stock", 400, { availableStock: product.stock });
      }

      if (existingItemIndex > -1) {
        const existingItem = cart.items[existingItemIndex];
        if (existingItem) {
          existingItem.quantity = newQty;
        }
      } else {
        cart.items.push({
          product: new mongoose.Types.ObjectId(productId!),
          quantity: quantity!,
          ...(colorId ? { color: new mongoose.Types.ObjectId(colorId!) } : {}),
          ...(sizeId ? { size: new mongoose.Types.ObjectId(sizeId!) } : {}),
        } as never);
      }

      await cart.save({ session });

      return success(
        res,
        {
          cartId: cart._id,
          totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        },
        existingItemIndex > -1
          ? "Quantity Increased in cart"
          : "Product added to cart",
      );
    });
  } catch (error) {
    logger.error({ err: error }, "Error in addToCart");
    if (error instanceof Error && error.name === "ValidationError") {
      return fail(res, "Validation failed", 400);
    }
    return fail(
      res,
      "Failed to add product to cart",
      500,
      error instanceof Error ? error.message : error,
    );
  }
});

// Update cart item quantity
export const updateCartItem = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      return await withOptionalTransaction(async (session) => {
        const { itemId: rawItemId } = req.params;
        const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;
        const { quantity } = req.body as { quantity?: number };
        const userId = req.user?._id;

        if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
          return fail(res, "Invalid item ID", 400);
        }

        if (!quantity || quantity < 1) {
          return fail(res, "Quantity must be at least 1", 400);
        }

        const cart = await Cart.findOne({ user: userId }).session(session);
        if (!cart) {
          return fail(res, "Cart not found", 404);
        }

        const itemIndex = cart.items.findIndex(
          (item) => item._id.toString() === itemId,
        );
        if (itemIndex === -1) {
          return fail(res, "Item not found in cart", 404);
        }

        const item = cart.items[itemIndex];
        if (!item) {
          return fail(res, "Item not found in cart", 404);
        }

        const product = await Product.findById(item.product)
          .select("stock")
          .session(session)
          .lean();

        if (!product || product.stock < quantity) {
          return fail(res, "Insufficient stock", 400, {
            availableStock: product?.stock ?? 0,
            currentQuantity: item.quantity,
          });
        }

        item.quantity = quantity!;
        await cart.save({ session });

        return success(
          res,
          { itemId, newQuantity: quantity },
          "Cart updated successfully",
        );
      });
    } catch (error) {
      logger.error({ err: error }, "Error in updateCartItem");
      return fail(
        res,
        "Failed to update cart",
        500,
      );
    }
  },
);

// Remove item from cart
export const removeFromCart = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      return await withOptionalTransaction(async (session) => {
        const { itemId: rawItemId } = req.params;
        const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;
        const userId = req.user?._id;

        if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
          return fail(res, "Invalid item ID", 400);
        }

        const cart = await Cart.findOne({ user: userId }).session(session);
        if (!cart) {
          return fail(res, "Cart not found", 404);
        }

        const initialCount = cart.items.length;
        cart.items = cart.items.filter(
          (item) => item._id.toString() !== itemId,
        ) as unknown as typeof cart.items;

        if (cart.items.length === initialCount) {
          return fail(res, "Item not found in cart", 404);
        }

        await cart.save({ session });

        return success(
          res,
          { itemId, remainingItems: cart.items.length },
          "Item removed from cart",
        );
      });
    } catch (error) {
      logger.error({ err: error }, "Error in removeFromCart");
      return fail(
        res,
        "Failed to remove item from cart",
        500,
      );
    }
  },
);

// Remove items from cart by product ID (and optional colorId)
// Used by the checkout page when cart validation fails (invalid_color, deleted, etc.)
export const removeFromCartByProduct = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      return await withOptionalTransaction(async (session) => {
        const { productId, colorId, sizeId } = req.body as {
          productId?: string;
          colorId?: string;
          sizeId?: string;
        };
        const userId = req.user?._id;

        if (!productId) {
          return fail(res, "Product ID is required", 400);
        }

        const cart = await Cart.findOne({ user: userId }).session(session);
        if (!cart) {
          return fail(res, "Cart not found", 404);
        }

        const beforeCount = cart.items.length;

        cart.items = cart.items.filter((item) => {
          const sameProduct = String(item.product) === productId;
          if (colorId) {
            if (sizeId) {
              return !(
                sameProduct &&
                String(item.color) === colorId &&
                String(item.size) === sizeId
              );
            }
            return !(sameProduct && String(item.color) === colorId);
          }
          if (sizeId) {
            return !(sameProduct && String(item.size) === sizeId);
          }
          return !sameProduct;
        }) as unknown as typeof cart.items;

        if (cart.items.length === beforeCount) {
          return fail(res, "Item not found in cart", 404);
        }

        await cart.save({ session });

        return success(
          res,
          { productId, remainingItems: cart.items.length },
          "Item removed from cart",
        );
      });
    } catch (error) {
      logger.error({ err: error }, "Error in removeFromCartByProduct");
      return fail(
        res,
        "Failed to remove item from cart",
        500,
      );
    }
  },
);

// Clear cart
export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  try {
    return await withOptionalTransaction(async (session) => {
      const userId = req.user?._id;

      const result = await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [] } },
        { new: true, session },
      );

      if (!result) {
        return fail(res, "Cart not found", 404);
      }

      return success(res, null, "Cart cleared successfully");
    });
  } catch (error) {
    logger.error({ err: error }, "Error in clearCart");
    return fail(
      res,
      "Failed to clear cart",
      500,
    );
  }
});
