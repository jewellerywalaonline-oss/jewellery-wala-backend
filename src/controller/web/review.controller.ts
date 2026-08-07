import type { Request, Response } from "express";
import Review from "../../models/review.js";
import { success, fail } from "../../utils/responses.js";
import { enqueue } from "../../lib/jobQueue.js";

export const createReview = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { productId, rating, comment } = req.body as {
      productId?: string;
      rating?: number;
      comment?: string;
    };
    const userId = req.user?._id;

    if (!userId) {
      return fail(res, "Please Login TO add review", 401);
    }

    if (!productId || !rating || !comment) {
      return fail(res, "Product ID, rating, and comment are required", 400);
    }

    const existingReview = await Review.findOne({ userId, productId, deletedAt: null }).select("_id").lean();
    if (existingReview) {
      return fail(res, "You have already reviewed this product", 400);
    }

    const review = await Review.create({ userId, productId, rating, comment }); // TODO: frontend Review uses createdAt for display

    enqueue("update-rating", { productId });

    return success(res, review, "Review submitted successfully", 201);
  } catch (error) {
    return fail(
      res,
      "Failed to create review",
      500,
    );
  }
};

export const getReviewsByProduct = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ productId, deletedAt: null })
      .populate("userId", "name email avatar")
      .sort("-createdAt") // TODO: frontend Review uses createdAt for display
      .lean();

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((acc, review) => acc + (review.rating ?? 0), 0) /
          reviews.length
        : 0;

    return success(
      res,
      reviews,
      "Product Reviews Found",
      200,
      { _rating: avgRating },
    );
  } catch (error) {
    return fail(
      res,
      "Failed to fetch reviews",
      500,
      [],
    );
  }
};