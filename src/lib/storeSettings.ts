import StoreSettings from "../models/storeSettings.js";
import { env } from "../config/env.js";

const SETTINGS_ID = "global";

/**
 * Get the store pickup pincode from the database, falling back to the
 * STORE_PICKUP_PINCODE env var if no DB setting has been saved yet.
 *
 * The DB setting allows admins to change this value through the admin panel
 * without needing to update environment variables.
 */
export async function getStorePickupPincode(): Promise<string> {
  try {
    const settings = await StoreSettings.findById(SETTINGS_ID)
      .select("storePickupPincode")
      .lean();

    if (settings?.storePickupPincode) {
      return settings.storePickupPincode;
    }
  } catch {
    // DB lookup failed — fall back to env
  }

  return env.STORE_PICKUP_PINCODE;
}
