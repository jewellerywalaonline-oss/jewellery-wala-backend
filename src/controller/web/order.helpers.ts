import crypto from "crypto";
import { env } from "../../config/env.js";

export interface RefundResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  payment_id: string;
  created_at: number;
}

export type OrderItemInput = {
  productId: string;
  colorId: string;
  sizeId?: string | null;
  name: string;
  description?: string;
  quantity: number;
  isPersonalized: boolean;
  personalizedName: string | null;
  priceAtPurchase: number;
  subtotal: number;
  addedFrom: string;
  images: string[];
  sku?: string;
  variantName?: string | null;
};

/**
 * Generate a 6-digit OTP (cryptographically secure).
 */
export const generateOTP = (): string => {
  return String(crypto.randomInt(100000, 1000000));
};

/**
 * Generate a unique package ID using the app name + random hex.
 */
export const generatePackageId = (): string => {
  return `${env.APP_NAME}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};
