import type { Request, Response } from "express";
import StoreSettings, { SETTINGS_ID } from "../../models/storeSettings.js";
import { logger } from "../../lib/logger.js";

export const getSettings = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    let settings = await StoreSettings.findById(SETTINGS_ID).lean();

    const pickupPincode = settings?.storePickupPincode || "";

    res.status(200).json({
      _status: true,
      _message: "Settings retrieved",
      _data: {
        storePickupPincode: pickupPincode,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Get store settings error");
    res.status(500).json({ _status: false, _message: "Internal server error" });
  }
};

export const updateSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { storePickupPincode } = req.body as {
      storePickupPincode?: string;
    };

    // Validate pincode format if provided
    if (storePickupPincode !== undefined && storePickupPincode !== "") {
      if (!/^\d{6}$/.test(storePickupPincode)) {
        res.status(400).json({
          _status: false,
          _message: "Pickup pincode must be a valid 6-digit pincode",
        });
        return;
      }
    }

    await StoreSettings.findByIdAndUpdate(
      SETTINGS_ID,
      {
        $set: {
          storePickupPincode: storePickupPincode || "",
        },
      },
      { upsert: true, runValidators: true },
    );

    res.status(200).json({
      _status: true,
      _message: "Settings updated successfully",
      _data: {
        storePickupPincode: storePickupPincode || "",
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Update store settings error");
    res.status(500).json({ _status: false, _message: "Internal server error" });
  }
};
