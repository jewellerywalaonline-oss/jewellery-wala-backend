import type { Request, Response } from "express";
import size from "../../models/size.js";
import cache from "../../lib/cache.js";

const extractValidationMessages = (err: unknown): string[] | null => {
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
    const data = new size(request.body);
    const ress = await data.save();
    cache.del("sizeData");

    response.status(201).json({
      _status: true,
      _message: "Data Inserted",
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
      _message: "Internal Server Error",
      _data: [],
    });
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

    if (request.query.name != undefined) {
      const name = new RegExp(request.query.name as string, "i");
      orCondition.push({ name });
    }
    if (orCondition.length > 0) filter.$or = orCondition;

    const ress = await size.find(filter)
      .select("_id name status order")
      .sort({ order: "asc", _id: "desc" })
      .lean();

    response.status(200).json({
      _status: true,
      _message: "Data Found",
      _data: ress,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Something Went Wrong",
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
        _message: "ID is required",
        _data: null,
      });
      return;
    }

    const existing = await size.findById(request.body.id).select("_id deletedAt").lean();
    if (!existing) {
      response.status(404).json({ _status: false, _message: "No Data Found", _data: null });
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await size.findByIdAndDelete(request.body.id);
      cache.del("sizeData");
      response.status(200).json({ _status: true, _message: "Data Permanently Deleted", _data: null });
      return;
    }

    await size.updateOne(
      { _id: request.body.id },
      { $set: { deletedAt: new Date() } },
    );
    cache.del("sizeData");
    response.status(200).json({
      _status: true,
      _message: "Data Deleted",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to delete data",
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
        _message: "ID is required",
        _data: null,
      });
      return;
    }

    const result = await size.findById({ _id: request.body.id }).lean();
    if (!result) {
      response.status(404).json({
        _status: false,
        _message: "No Data Found",
        _data: null,
      });
      return;
    }

    response.status(200).json({
      _status: true,
      _message: "Data Found",
      _data: result,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to fetch data",
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
        _message: "ID is required",
        _data: null,
      });
      return;
    }

    const ress = await size.updateOne({ _id: id }, { $set: request.body });
    if (ress.matchedCount === 0) {
      response.status(404).json({
        _status: false,
        _message: "No Data Found",
        _data: null,
      });
      return;
    }
    cache.del("sizeData");
    response.status(200).json({
      _status: true,
      _message: "Data Updated",
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
      _message: "Failed to update data",
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
        _message: "ID is required",
        _data: null,
      });
      return;
    }

    const result = await size.updateMany(
      { _id: request.body.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    if (result.matchedCount === 0) {
      response.status(404).json({
        _status: false,
        _message: "No Data Found",
        _data: null,
      });
      return;
    }
    cache.del("sizeData");
    response.status(200).json({
      _status: true,
      _message: "Status Changed",
      _data: result,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to change status",
      _data: null,
    });
  }
};
