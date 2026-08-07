import type { Request, Response } from "express";
import category from "../../models/category.js";
import { generateUniqueSlug } from "../../lib/slugFunc.js";
import { uploadToR2 } from "../../lib/cloudflare.js";
import cache from "../../lib/cache.js";

export const create = async (
  request: Request,
  response: Response,
): Promise<void> => {
  if (!request.body) {
    response.status(500).json({ _status: false, _message: "Request body is empty", _data: [] });
    return;
  }
  try {
    const categoryDoc = new category(request.body);

    const slug = await generateUniqueSlug(category, categoryDoc.name);
    categoryDoc.slug = slug;

    const categoryName = request.body?.name as string | undefined;

    if (request.file) {
      const uploadResult = await uploadToR2(request.file, "categories", 80, categoryName);
      if (uploadResult.success) {
        categoryDoc.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const ress = await categoryDoc.save();
    cache.del("navigationData");
    response.send({
      _status: true,
      _message: "Category created successfully",
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
      messages.push("Something went wrong");
    }
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
      if (request.body.name != undefined) {
        const name = new RegExp(request.body.name, "i");
        orCondition.push({ name });
      }
      if (request.body.status != undefined) {
        andCondition.push({ status: request.body.status });
      }
    }
    if (orCondition.length > 0) filter.$or = orCondition;

    const ress = await category
      .find(filter)
      .sort({ order: "asc", _id: "desc" })
      .lean();

    response.send({
      _status: true,
      _message: "Categories found",
      _data: ress,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to fetch categories",
      _data: null,
    });
  }
};

export const destroy = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    // Route is /delete/:id — id comes from the URL param.
    const id = request.params.id;
    const existing = await category.findById(id)
      .select("_id deletedAt")
      .lean();
    if (!existing) {
      response.status(500).json({ _status: false, _message: "Category not found", _data: null });
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await category.findByIdAndDelete(id);
      cache.del("navigationData");
      response.status(200).json({ _status: true, _message: "Category permanently deleted", _data: null });
      return;
    }
    // Soft delete
    await category.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } },
    );
    cache.del("navigationData");
    response.send({
      _status: true,
      _message: "Category deleted",
      _data: null,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to delete category",
      _data: null,
    });
  }
};

export const details = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    // Route is /details/:id — id comes from the URL param.
    const result = await category.findById({ _id: request.params.id }).lean();
    if (result) {
      response.status(200).json({
        _status: true,
        _message: "Category found",
        _data: result,
      });
    } else {
      response.status(404).json({
        _status: false,
        _message: "Category not found",
        _data: null,
      });
    }
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to fetch category details",
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
    const updateData: Record<string, unknown> = { ...request.body };

    const categoryName = updateData.name as string | undefined;

    if (request.file) {
      const uploadResult = await uploadToR2(request.file, "categories", 80, categoryName);
      if (uploadResult.success) {
        updateData.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    if (updateData.name) {
      const slug = await generateUniqueSlug(category, updateData.name as string);
      updateData.slug = slug;
    }

    const ress = await category.updateOne(
      { _id: id },
      { $set: updateData },
    );
    cache.del("navigationData");
    response.send({
      _status: true,
      _message: "Category updated",
      _data: ress,
    });
  } catch (err) {
    cache.del("navigationData");
    response.send({
      _status: false,
      _message: "Failed to update category",
      _data: null,
    });
  }
};

export const restore = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const { id } = request.params;
    if (!id) {
      response.status(400).json({ _status: false, _message: "Category ID is required", _data: null });
      return;
    }
    await category.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    cache.del("navigationData");
    response.status(200).json({
      _status: true,
      _message: "Category restored successfully",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to restore category",
      _data: null,
    });
  }
};

export const changeStatus = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    // Route is /change-status/:id — id comes from the URL param.
    const result = await category.updateMany(
      { _id: request.params.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    cache.del("navigationData");
    response.send({
      _status: true,
      _message: "Category status changed",
      _data: result,
    });
  } catch (err) {
    cache.del("navigationData");
    response.send({
      _status: false,
      _message: "Failed to change category status",
      _data: null,
    });
  }
};
