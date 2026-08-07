import type { Request, Response } from "express";
import logoModal from "../../models/logo.js";
import { uploadToR2 } from "../../lib/cloudflare.js";
import cache from "../../lib/cache.js";

export const create = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = req.body as Record<string, unknown>;

    if (req.file) {
      const uploadResult = await uploadToR2(req.file, "logos");
      if (uploadResult.success) {
        data.logo = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const logo = await logoModal.create(data);
    cache.del("logoData");
    res.status(201).json({
      _status: true,
      _message: "Logo Created Successfully",
      _data: logo,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to create logo",
      _data: null,
    });
  }
};

export const view = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    const isDeletedAt = req.body?.isDeletedAt ?? req.query?.isDeletedAt;
    if (isDeletedAt === "all") {
      // No deletedAt filter — show all
    } else if (isDeletedAt === "deleted") {
      filter.deletedAt = { $ne: null };
    } else {
      // Default: active (non-deleted) only
      filter.deletedAt = null;
    }

    const logos = await logoModal
      .find(filter)
      .select("_id logo linkText linkUrl status createdAt")
      .sort({ createdAt: "desc" })
      .lean();
    res.status(200).json({
      _status: true,
      _message: "Logos Found",
      _data: logos,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to fetch logos",
      _data: null,
    });
  }
};

export const update = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = req.body as Record<string, unknown>;

    const existingLogo = await logoModal.findById(req.params.id).select("_id logo").lean();
    if (!existingLogo) {
      res.status(404).json({
        _status: false,
        _message: "Logo Not Found",
        _data: null,
      });
      return;
    }

    if (req.file) {
      const uploadResult = await uploadToR2(req.file, "logos");
      if (uploadResult.success) {
        data.logo = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const logo = await logoModal.findByIdAndUpdate(req.params.id, {
      $set: data,
    });
    cache.del("logoData");
    res.status(200).json({
      _status: true,
      _message: "Logo Updated Successfully",
      _data: logo,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to update logo",
      _data: null,
    });
  }
};

export const destroy = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const logo = await logoModal.findById(req.params.id)
      .select("_id deletedAt")
      .lean();
    if (!logo) {
      res.status(404).json({
        _status: false,
        _message: "Logo Not Found",
        _data: null,
      });
      return;
    }
    if (logo.deletedAt) {
      // Already soft-deleted → permanently delete
      await logoModal.findByIdAndDelete(req.params.id);
      cache.del("logoData");
      res.status(200).json({ _status: true, _message: "Logo Permanently Deleted", _data: null });
      return;
    }
    await logoModal.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
    cache.del("logoData");
    res.status(200).json({
      _status: true,
      _message: "Logo Deleted",
      _data: null,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to delete logo",
      _data: null,
    });
  }
};

export const restore = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ _status: false, _message: "Logo ID is required", _data: null });
      return;
    }
    await logoModal.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    cache.del("logoData");
    res.status(200).json({
      _status: true,
      _message: "Logo restored successfully",
      _data: null,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to restore logo",
      _data: null,
    });
  }
};

export const changeStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const logo = await logoModal.updateMany(
      { _id: req.body.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    cache.del("logoData");
    res.status(200).json({
      _status: true,
      _message: "Status Changed Successfully",
      _data: logo,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to change status",
      _data: null,
    });
  }
};
