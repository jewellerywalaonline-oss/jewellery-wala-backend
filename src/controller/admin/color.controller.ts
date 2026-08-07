import type { Request, Response } from "express";
import color from "../../models/color.js";
import cache, { delByPrefix } from "../../lib/cache.js";

const extractValidationMessages = (
  err: unknown,
): string[] | null => {
  if (!(err instanceof Error) || !("errors" in err)) return null;
  const errorObj = (err as { errors?: Record<string, { message: string }> }).errors;
  if (!errorObj || typeof errorObj !== "object") return null;
  const messages: string[] = [];
  for (const msg in errorObj) {
    if (errorObj[msg]?.message) messages.push(errorObj[msg].message);
  }
  return messages.length > 0 ? messages : null;
};

export const create = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const data = new color(request.body);
    const ress = await data.save();
    delByPrefix("admin_color_view");
    response.status(201).json({
      _status: true,
      _message: "Color created successfully",
      _data: ress,
    });
  } catch (err) {
    const messages = extractValidationMessages(err);
    if (messages) {
      response.status(400).json({
        _status: false,
        _message: messages,
        _data: [],
      });
      return;
    }
    response.status(500).json({
      _status: false,
      _message: "Failed to create color — an unexpected error occurred",
      _data: [],
    });
  }
};

export const view = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const isDeletedAt = request.body?.isDeletedAt ?? request.query?.isDeletedAt;
    const cacheKey = `admin_color_view_${isDeletedAt ?? "active"}`;
    const cached = cache.get<{ _status: boolean; _message: string; _data: unknown[] }>(cacheKey);
    if (cached) { response.status(200).json(cached); return; }

    const andCondition: Record<string, unknown>[] = [];
    const orCondition: Record<string, unknown>[] = [];
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

    if (request.query.name != undefined) {
      const name = new RegExp(request.query.name as string, "i");
      orCondition.push({ name }, { code: name });
    }
    if (orCondition.length > 0) filter.$or = orCondition;

    const ress = await color
      .find(filter)
      .select("_id name code status order")
      .sort({ order: "asc", _id: "desc" })
      .lean();

    const responseData = { _status: true, _message: "Colors found", _data: ress };
    cache.set(cacheKey, responseData, 300);
    response.status(200).json(responseData);
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to fetch colors",
      _data: null,
    });
  }
};

export const destroy = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    if (!request.body.id) {
      response.status(400).json({
        _status: false,
        _message: "Color ID is required",
        _data: null,
      });
      return;
    }

    const existing = await color.findById(request.body.id).select("_id deletedAt").lean();
    if (!existing) {
      response.status(404).json({ _status: false, _message: "Color not found", _data: null });
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await color.findByIdAndDelete(request.body.id);
      delByPrefix("admin_color_view");
      response.status(200).json({ _status: true, _message: "Color permanently deleted", _data: null });
      return;
    }

    await color.updateOne(
      { _id: request.body.id },
      { $set: { deletedAt: new Date() } },
    );
    delByPrefix("admin_color_view");

    response.status(200).json({
      _status: true,
      _message: "Color deleted",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to delete color",
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
      response.status(400).json({ _status: false, _message: "Color ID is required", _data: null });
      return;
    }
    await color.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    delByPrefix("admin_color_view");
    response.status(200).json({
      _status: true,
      _message: "Color restored successfully",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to restore color",
      _data: null,
    });
  }
};

export const details = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    if (!request.body.id) {
      response.status(400).json({
        _status: false,
        _message: "Color ID is required",
        _data: null,
      });
      return;
    }

    const result = await color.findById({ _id: request.body.id }).lean();
    if (!result) {
      response.status(404).json({
        _status: false,
        _message: "Color not found",
        _data: null,
      });
      return;
    }

    response.status(200).json({
      _status: true,
      _message: "Color found",
      _data: result,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to fetch color details",
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
    if (!id) {
      response.status(400).json({
        _status: false,
        _message: "Color ID is required",
        _data: null,
      });
      return;
    }

    const ress = await color.updateOne({ _id: id }, { $set: request.body });

    if (ress.matchedCount === 0) {
      response.status(404).json({
        _status: false,
        _message: "Color not found",
        _data: null,
      });
      return;
    }
    delByPrefix("admin_color_view");
    response.status(200).json({
      _status: true,
      _message: "Color updated",
      _data: ress,
    });
  } catch (err) {
    const messages = extractValidationMessages(err);
    if (messages) {
      response.status(400).json({
        _status: false,
        _message: messages,
        _data: null,
      });
      return;
    }
    response.status(500).json({
      _status: false,
      _message: "Failed to update color",
      _data: null,
    });
  }
};

export const changeStatus = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    if (!request.body.id) {
      response.status(400).json({
        _status: false,
        _message: "Color ID is required",
        _data: null,
      });
      return;
    }

    const result = await color.updateMany(
      { _id: request.body.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    delByPrefix("admin_color_view");
    if (result.matchedCount === 0) {
      response.status(404).json({
        _status: false,
        _message: "Color not found",
        _data: null,
      });
      return;
    }
    response.status(200).json({
      _status: true,
      _message: "Color status changed",
      _data: result,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to change color status",
      _data: null,
    });
  }
};