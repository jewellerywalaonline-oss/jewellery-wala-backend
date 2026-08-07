import type { Request, Response } from "express";
import faqs from "../../models/faq.js";
import cache from "../../lib/cache.js";

export const create = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const data = new faqs({ ...request.body });
    const ress = await data.save();
    response.send({
      _status: true,
      _message: "FAQ created successfully",
      _data: ress,
    });
  } catch (err) {
    const messages: string[] = [];
    if (err instanceof Error && "errors" in err) {
      const errors = (err as Record<string, unknown>).errors as Record<string, { message: string }> | undefined;
      if (errors) {
        for (const msg in errors) {
          if (errors[msg]?.message) {
            messages.push(errors[msg].message);
          }
        }
      }
    } else if (err instanceof Error) {
      messages.push(err.message);
    } else {
      messages.push("Failed to create FAQ");
    }
    cache.del("faqData");
    response.status(500).json({ _status: false, _message: messages, _data: [] });
  }
};

export const view = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const andCondition: Record<string, unknown>[] = [];
    const orCondition: Record<string, unknown>[] = [];

    const isDeletedAt = request.body?.isDeletedAt ?? request.query?.isDeletedAt;
    if (isDeletedAt === "all") {
      // No deletedAt filter — show all
    } else if (isDeletedAt === "deleted") {
      andCondition.push({ deletedAt: { $ne: null } });
    } else {
      // Default: active (non-deleted) only
      andCondition.push({ deletedAt: null });
    }

    const filter: Record<string, unknown> = {};
    if (andCondition.length > 0) filter.$and = andCondition;

    if (request.body != undefined) {
      if (request.body.search != undefined) {
        const name = new RegExp(request.body.search, "i");
        orCondition.push({ question: name }, { answer: name });
      }
    }
    if (orCondition.length > 0) filter.$or = orCondition;

    const ress = await faqs
      .find(filter)
      .select("_id question answer status order")
      .sort({ order: "asc", _id: "desc" })
      .lean();

    response.send({
      _status: true,
      _message: "FAQs found",
      _data: ress,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to fetch FAQs",
      _data: null,
    });
  }
};

export const destroy = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const existing = await faqs.findById(request.body.id).select("_id deletedAt").lean();
    if (!existing) {
      response.status(500).json({ _status: false, _message: "FAQ not found", _data: null });
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await faqs.findByIdAndDelete(request.body.id);
      cache.del("faqData");
      response.status(200).json({ _status: true, _message: "FAQ permanently deleted", _data: null });
      return;
    }
    await faqs.updateOne(
      { _id: request.body.id },
      { $set: { deletedAt: new Date() } },
    );
    cache.del("faqData");
    response.send({
      _status: true,
      _message: "FAQ deleted",
      _data: null,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to delete FAQ",
      _data: null,
    });
  }
};

export const details = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const result = await faqs.findById({ _id: request.body.id }).lean();
    if (result) {
      response.status(200).json({
        _status: true,
        _message: "FAQ found",
        _data: result,
      });
    } else {
      response.status(404).json({
        _status: false,
        _message: "FAQ not found",
        _data: null,
      });
    }
  } catch (err) {
    response.send({
      _status: false,
      _message: "FAQ not found",
      _data: null,
    });
  }
};

export const update = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const id = request.params.id;
    const ress = await faqs.updateOne(
      { _id: id },
      { $set: { ...request.body, updated_at: new Date() } },
    );
    cache.del("faqData");
    response.send({
      _status: true,
      _message: "FAQ updated",
      _data: ress,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to update FAQ",
      _data: null,
    });
  }
};

export const restore = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    // The admin panel sends the id in the body (route is /restore, not /restore/:id).
    const { id } = request.body;
    if (!id) {
      response.status(400).json({ _status: false, _message: "FAQ ID is required", _data: null });
      return;
    }
    await faqs.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    cache.del("faqData");
    response.status(200).json({
      _status: true,
      _message: "FAQ restored successfully",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to restore FAQ",
      _data: null,
    });
  }
};

export const changeStatus = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const result = await faqs.updateMany(
      { _id: request.body.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    cache.del("faqData");
    response.send({
      _status: true,
      _message: "FAQ status changed",
      _data: result,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to change FAQ status",
      _data: null,
    });
  }
};
