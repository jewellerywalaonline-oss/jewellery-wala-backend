import type { Request, Response } from "express";
import testimonial from "../../models/testimonial.js";
import { uploadToR2 } from "../../lib/cloudflare.js";
import cache from "../../lib/cache.js";

export const create = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const data = new testimonial(request.body);

    const testimonialName = (request.body?.name as string) || (request.body?.title as string) || undefined;

    if (request.file) {
      const uploadResult = await uploadToR2(request.file, "testimonials", 80, testimonialName);
      if (uploadResult.success) {
        data.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const ress = await data.save();
    cache.del("testimonialData");
    response.send({
      _status: true,
      _message: "Testimonial created successfully",
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
      messages.push("Failed to create testimonial");
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
      if (request.body.title != undefined) {
        const title = new RegExp(request.body.title, "i");
        orCondition.push({ title, description: title });
      }
      if (request.body.status != undefined) {
        andCondition.push({ status: request.body.status });
      }
    }
    if (orCondition.length > 0) filter.$or = orCondition;

    const ress = await testimonial
      .find(filter)
      .select("_id title image description rating status order address")
      .sort({ order: "asc", _id: "desc" })
      .lean();

    response.send({
      _status: true,
      _message: "Testimonials found",
      _data: ress,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to fetch testimonials",
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
    const existing = await testimonial.findById(id).select("_id deletedAt").lean();
    if (!existing) {
      response.status(500).json({ _status: false, _message: "Testimonial not found", _data: null });
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await testimonial.findByIdAndDelete(id);
      cache.del("testimonialData");
      response.status(200).json({ _status: true, _message: "Testimonial permanently deleted", _data: null });
      return;
    }
    await testimonial.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } },
    );
    cache.del("testimonialData");
    response.send({
      _status: true,
      _message: "Testimonial deleted",
      _data: null,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to delete testimonial",
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
    const result = await testimonial.findById({ _id: request.params.id }).lean();
    if (result) {
      response.status(200).json({
        _status: true,
        _message: "Testimonial found",
        _data: result,
      });
    } else {
      response.status(404).json({
        _status: false,
        _message: "Testimonial not found",
        _data: null,
      });
    }
  } catch (err) {
    response.send({
      _status: false,
      _message: "Testimonial not found",
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
    const data: Record<string, unknown> = { ...request.body };

    const testimonialName = (data.name as string) || (data.title as string) || undefined;

    if (request.file) {
      const uploadResult = await uploadToR2(request.file, "testimonials", 80, testimonialName);
      if (uploadResult.success) {
        data.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const ress = await testimonial.updateOne({ _id: id }, { $set: data });
    cache.del("testimonialData");
    response.send({
      _status: true,
      _message: "Testimonial updated",
      _data: ress,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to update testimonial",
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
      response.status(400).json({ _status: false, _message: "Testimonial ID is required", _data: null });
      return;
    }
    await testimonial.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    cache.del("testimonialData");
    response.status(200).json({
      _status: true,
      _message: "Testimonial restored successfully",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to restore testimonial",
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
    const result = await testimonial.updateMany(
      { _id: request.params.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    cache.del("testimonialData");
    response.send({
      _status: true,
      _message: "Testimonial status changed",
      _data: result,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to change testimonial status",
      _data: null,
    });
  }
};