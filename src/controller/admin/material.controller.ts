import type { Request, Response } from "express";
import material from "../../models/material.js";
import cache, { delByPrefix } from "../../lib/cache.js";

const extractValidationMessages = (err: import("mongoose").Error.ValidationError | unknown): string[] | null => {
  if (!(err instanceof Error) || !("errors" in err)) return null;
  const errorObj = (err as Record<string, unknown>).errors as Record<string, { message: string }> | undefined;
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
    const data = new material(request.body);
    const ress = await data.save();
    delByPrefix("admin_material_view");

    response.status(201).json({
      _status: true,
      _message: "Material created successfully",
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
      _message: "Failed to create material — an unexpected error occurred",
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
    const cacheKey = `admin_material_view_${isDeletedAt ?? "active"}`;
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
      orCondition.push({ name });
    }
    if (orCondition.length > 0) filter.$or = orCondition;

    const ress = await material
      .find(filter)
      .select("_id name status order")
      .sort({ order: "asc", _id: "desc" })
      .lean();

    const responseData = { _status: true, _message: "Materials found", _data: ress };
    cache.set(cacheKey, responseData, 300);
    response.status(200).json(responseData);
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to fetch materials",
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
        _message: "Material ID is required",
        _data: null,
      });
      return;
    }

    const existing = await material.findById(request.body.id).select("_id deletedAt").lean();
    if (!existing) {
      response.status(404).json({ _status: false, _message: "Material not found", _data: null });
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await material.findByIdAndDelete(request.body.id);
      delByPrefix("admin_material_view");
      response.status(200).json({ _status: true, _message: "Material permanently deleted", _data: null });
      return;
    }

    await material.updateOne(
      { _id: request.body.id },
      { $set: { deletedAt: new Date() } },
    );
    delByPrefix("admin_material_view");
    response.status(200).json({
      _status: true,
      _message: "Material deleted",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to delete material",
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
      response.status(400).json({ _status: false, _message: "Material ID is required", _data: null });
      return;
    }
    await material.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    delByPrefix("admin_material_view");
    response.status(200).json({
      _status: true,
      _message: "Material restored successfully",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to restore material",
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
        _message: "Material ID is required",
        _data: null,
      });
      return;
    }

    const result = await material.findById({ _id: request.body.id }).lean();
    if (!result) {
      response.status(404).json({
        _status: false,
        _message: "Material not found",
        _data: null,
      });
      return;
    }

    response.status(200).json({
      _status: true,
      _message: "Material found",
      _data: result,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to fetch material details",
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
        _message: "Material ID is required",
        _data: null,
      });
      return;
    }

    const ress = await material.updateOne(
      { _id: id },
      { $set: request.body },
    );
    if (ress.matchedCount === 0) {
      response.status(404).json({
        _status: false,
        _message: "Material not found",
        _data: null,
      });
      return;
    }
    delByPrefix("admin_material_view");
    response.status(200).json({
      _status: true,
      _message: "Material updated",
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
      _message: "Failed to update material",
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
        _message: "Material ID is required",
        _data: null,
      });
      return;
    }

    const result = await material.updateMany(
      { _id: request.body.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    if (result.matchedCount === 0) {
      response.status(404).json({
        _status: false,
        _message: "Material not found",
        _data: null,
      });
      return;
    }
    delByPrefix("admin_material_view");
    response.status(200).json({
      _status: true,
      _message: "Material status changed",
      _data: result,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to change material status",
      _data: null,
    });
  }
};