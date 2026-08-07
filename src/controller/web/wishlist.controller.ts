import type { Request, Response } from "express";
import mongoose from "mongoose";
import Wishlist from "../../models/wishlist.js";
import Product from "../../models/product.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { success, fail } from "../../utils/responses.js";
import { logger } from "../../lib/logger.js";
import { withOptionalTransaction } from "../../lib/transactions.js";

interface PopulatedWishlistProduct {
  _id: string;
  name: string;
  price: number;
  discount_price: number;
  image?: string;
  images: string[];
  slug: string;
  stock?: number;
}

interface PopulatedWishlist {
  _id: import("mongoose").Types.ObjectId;
  user: import("mongoose").Types.ObjectId;
  products: PopulatedWishlistProduct[];
}

export const getWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const wishlist = await Wishlist.findOne({ user: userId })
      .populate("products", "name price discount_price image images slug stock")
      .lean<PopulatedWishlist | null>();

    if (!wishlist || wishlist.products.length === 0) {
      return success(res, [], "Your wishlist is empty");
    }

    const items = wishlist.products.map((product) => ({
      _id: product._id,
      name: product.name,
      price: product.price,
      discount_price: product.discount_price,
      image: product.image ?? null,
      slug: product.slug,
      stock: product.stock ?? 0,
    }));

    return success(res, items, "Wishlist retrieved successfully");
  },
);

export const addToWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      return await withOptionalTransaction(async (session) => {
        const { productId } = req.body as { productId?: string };
        const userId = req.user?._id;

        if (!productId) {
          return fail(res, "Product ID is required", 400);
        }

        const product = await Product.findOne({
          _id: productId,
          status: "active",
          deletedAt: null,
        }).lean().session(session);

        if (!product) {
          return fail(res, "Product not found or not available", 404);
        }

        let wishlist = await Wishlist.findOne({ user: userId }).session(session);
        if (!wishlist) {
          wishlist = new Wishlist({ user: userId, products: [] });
        }

        if (wishlist.products.some((p) => p.toString() === productId)) {
          return fail(res, "Product already in wishlist", 400);
        }

        wishlist.products.push(new mongoose.Types.ObjectId(productId));
        await wishlist.save({ session });

        return success(
          res,
          {
            wishlistId: wishlist._id,
            totalItems: wishlist.products.length,
          },
          "Product added to wishlist successfully",
        );
      });
    } catch (error) {
      logger.error({ err: error }, "Error in addToWishlist");
      if (error instanceof Error && error.name === "ValidationError") {
        return fail(res, "Validation failed", 400);
      }
      return fail(
        res,
        "Failed to add product to wishlist",
        500,
        error instanceof Error ? error.message : error,
      );
    }
  },
);

export const removeFromWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      return await withOptionalTransaction(async (session) => {
        const { productId: rawProductId } = req.params;
        const productId = Array.isArray(rawProductId) ? rawProductId[0] : rawProductId;
        const userId = req.user?._id;

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
          return fail(res, "Invalid product ID", 400);
        }

        const wishlist = await Wishlist.findOne({ user: userId }).session(
          session,
        );
        if (!wishlist) {
          return fail(res, "Wishlist not found", 404);
        }

        const initialCount = wishlist.products.length;
        wishlist.products = wishlist.products.filter(
          (p) => p.toString() !== productId,
        );

        if (wishlist.products.length === initialCount) {
          return fail(res, "Product not found in wishlist", 404);
        }

        await wishlist.save({ session });

        return success(
          res,
          {
            productId,
            remainingItems: wishlist.products.length,
          },
          "Product removed from wishlist",
        );
      });
    } catch (error) {
      logger.error({ err: error }, "Error in removeFromWishlist");
      return fail(
        res,
        "Failed to remove product from wishlist",
        500,
      );
    }
  },
);

export const checkInWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId: rawProductId } = req.params;
    const productId = Array.isArray(rawProductId) ? rawProductId[0] : rawProductId;
    const userId = req.user?._id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return fail(res, "Invalid product ID", 400);
    }

    const wishlist = await Wishlist.findOne({
      user: userId,
      products: productId,
    })
      .select("_id")
      .lean();

    return success(res, { isInWishlist: !!wishlist }, "Wishlist status retrieved");
  },
);
