import type { Request, Response } from "express";
import Coupen from "../../models/coupen.js";
import { success, fail } from "../../utils/responses.js";
import { logger } from "../../lib/logger.js";

export const coupenPopUp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const coupenId = req.params.id;
    const coupen = await Coupen.findById(coupenId)
      .select("_id code discount type expiryDate minAmount status isUsed userId")
      .lean();
    if (!coupen) return fail(res, "Coupen Not Found", 404);
    if (coupen.expiryDate && new Date(coupen.expiryDate) < new Date()) {
      return fail(res, "Coupon has expired", 400);
    }
    return success(res, coupen, "Coupen Found");
  } catch (error) {
    logger.error({ err: error }, "Coupen Pop Up Error");
    return fail(res, "Couldnt Find Coupen", 500);
  }
};

export const findCoupen = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?._id;
    const coupen = await Coupen.find({
      userId,
      deletedAt: null,
      status: true,
      isUsed: false,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: new Date() } },
      ],
    })
      .select("_id code discount type expiryDate minAmount userId")
      .lean();
    return success(res, coupen, "Coupen Found");
  } catch (error) {
    logger.error({ err: error }, "Coupen Pop Up Error");
    return fail(res, "Couldnt Find Coupen", 500);
  }
};