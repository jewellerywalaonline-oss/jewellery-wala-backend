import type { Request, Response } from "express";
import auditLogModel from "../../models/auditLog.js";
import { logger } from "../../lib/logger.js";

export const listAuditLogs = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const logs = await auditLogModel
      .find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.status(200).json({
      _status: true,
      _message: "Audit logs fetched successfully",
      _data: logs,
    });
  } catch (error) {
    logger.error({ err: error }, "listAuditLogs error");
    res.status(500).json({ _status: false, _message: "Internal Server Error" });
  }
};

export const clearAuditLogs = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    await auditLogModel.deleteMany({});
    res.status(200).json({
      _status: true,
      _message: "Audit logs cleared successfully",
    });
  } catch (error) {
    logger.error({ err: error }, "clearAuditLogs error");
    res.status(500).json({ _status: false, _message: "Internal Server Error" });
  }
};
