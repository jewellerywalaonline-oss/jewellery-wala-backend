import type { Request, Response } from "express";
import AiResponse from "../../models/aiResponse.js";
import { logger } from "../../lib/logger.js";
import { success, fail } from "../../utils/responses.js";
/// <reference path="../../types/express.d.ts" />

export const createAiResponse = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { prompt, response, page } = req.body as {
      prompt: string;
      response: string;
      page?: string;
    };

    if (!prompt || !response) {
      return fail(res, "Prompt and response are required", 400);
    }

    const adminId = req.user?._id;
    if (!adminId) {
      return fail(res, "Unauthorized", 401);
    }

    const aiResponse = await AiResponse.create({
      prompt,
      response,
      page: page || "other",
      adminId,
    });

    return success(res, aiResponse, "AI response saved");
  } catch (err) {
    logger.error({ err }, "Error saving AI response");
    return fail(res, "Failed to save AI response", 500);
  }
};

export const listAiResponses = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { page: reqPage, limit: reqLimit, pageFilter } = req.body as {
      page?: number;
      limit?: number;
      pageFilter?: string;
    };

    const pageNum = typeof reqPage === "number" ? reqPage : 1;
    const limit = typeof reqLimit === "number" ? reqLimit : 50;
    const skip = (pageNum - 1) * limit;

    const filter: { page?: string } = {};
    if (pageFilter) {
      filter.page = pageFilter;
    }

    const [responses, total] = await Promise.all([
      AiResponse.find(filter)
        .populate("adminId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AiResponse.countDocuments(filter),
    ]);

    return success(
      res,
      {
        _data: responses,
        _pagination: {
          total,
          page: pageNum,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      "AI responses fetched",
    );
  } catch (err) {
    logger.error({ err }, "Error listing AI responses");
    return fail(res, "Failed to list AI responses", 500);
  }
};

export const deleteAiResponse = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { id } = req.params;

    const result = await AiResponse.findByIdAndDelete(id);
    if (!result) {
      return fail(res, "AI response not found", 404);
    }

    return success(res, null, "AI response permanently deleted");
  } catch (err) {
    logger.error({ err }, "Error deleting AI response");
    return fail(res, "Failed to delete AI response", 500);
  }
};
