import type { Request, Response } from "express";
import Reviews from "../../models/review.js";
import { sendEmail } from "../../lib/nodemailer.js";
import { logger } from "../../lib/logger.js";

const POPULATE_USER = { path: "userId", select: "name email" } as const;
const POPULATE_PRODUCT = { path: "productId", select: "name slug images" } as const;

export const getAllReviews = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const isDeletedAt = (req.body?.isDeletedAt ?? req.query?.isDeletedAt) as string | undefined;

    const query: Record<string, unknown> = {};
    if (isDeletedAt === "all") {
      // no deletedAt filter — show everything
    } else if (isDeletedAt === "deleted") {
      query.deletedAt = { $ne: null };
    } else {
      query.deletedAt = null;
    }

    const reviews = await Reviews.find(query)
      .populate(POPULATE_USER)
      .populate(POPULATE_PRODUCT)
      .select("_id userId productId rating comment status createdAt")
      .sort("-createdAt")
      .lean();
    res.status(200).json({
      _status: true,
      _message: "All reviews fetched successfully",
      _data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to fetch reviews",
      _data: [],
    });
  }
};

export const getReviewById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const review = await Reviews.findById(id)
      .populate(POPULATE_USER)
      .populate(POPULATE_PRODUCT)
      .lean();
    if (!review) {
      res.status(404).json({
        _status: false,
        _message: "Review not found",
        _data: null,
      });
      return;
    }
    res.status(200).json({
      _status: true,
      _message: "Review fetched successfully",
      _data: review,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to fetch review",
      _data: null,
    });
  }
};

export const updateReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await Reviews.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      res.status(404).json({
        _status: false,
        _message: "Review not found",
        _data: null,
      });
      return;
    }
    res.status(200).json({
      _status: true,
      _message: "Review updated successfully",
      _data: updated,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to update review",
      _data: null,
    });
  }
};

export const deleteReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const review = await Reviews.findById(id)
      .populate(POPULATE_USER)
      .populate(POPULATE_PRODUCT)
      .lean();
    if (!review) {
      res.status(404).json({
        _status: false,
        _message: "Review not found",
        _data: null,
      });
      return;
    }

    // Send deletion email to the user (only for first-time soft-delete, not for permanent delete)
    const isAlreadyDeleted = !!review.deletedAt;
    const user = review.userId as unknown as { _id: string; name: string; email: string } | null;
    const product = review.productId as unknown as { _id: string; name: string; slug: string; images: string[] } | null;
    if (!isAlreadyDeleted && user && user.email && product) {
      try {
        await sendEmail(user.email, "reviewDeleted", {
          user: { name: user.name },
          product: { name: product.name },
          review: {
            rating: review.rating,
            comment: (review as Record<string, unknown>).comment ?? "",
          },
        });
        logger.info({ reviewId: id, userId: user._id }, "Review deletion email sent");
      } catch (emailError) {
        logger.error({ err: emailError, reviewId: id }, "Failed to send review deletion email");
      }
    }

    // Already soft-deleted → permanently delete
    if (isAlreadyDeleted) {
      await Reviews.findByIdAndDelete(id);
      logger.info({ reviewId: id }, "Review permanently deleted");
      res.status(200).json({
        _status: true,
        _message: "Review permanently deleted",
        _data: null,
      });
      return;
    }

    // Soft delete for user-attached reviews (or permanently delete if no user)
    await Reviews.findByIdAndUpdate(id, { deletedAt: new Date() });
    res.status(200).json({
      _status: true,
      _message: "Review marked as deleted successfully",
      _data: null,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to delete review",
      _data: null,
    });
  }
};

export const restoreReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ _status: false, _message: "Review ID is required", _data: null });
      return;
    }
    await Reviews.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    res.status(200).json({
      _status: true,
      _message: "Review restored successfully",
      _data: null,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to restore review",
      _data: null,
    });
  }
};

export const changeStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await Reviews.updateMany(
      { _id: id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    if (result.matchedCount === 0) {
      res.status(404).json({
        _status: false,
        _message: "Review not found",
        _data: null,
      });
      return;
    }
    res.status(200).json({
      _status: true,
      _message: "Status Changed",
      _data: result,
    });
  } catch {
    // Original swallow; preserved.
  }
};