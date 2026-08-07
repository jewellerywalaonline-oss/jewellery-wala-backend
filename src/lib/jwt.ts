import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtPayload, PasswordResetJwtPayload } from "../types/jwt.js";

/**
 * Generate an access token.
 * Admin tokens last 7 days, user/delivery tokens last 7 days.
 * Refresh tokens live longer (5-10 days) and are rotated on each use.
 * Increasing the access token duration reduces the chance of mid-session
 * expiry during checkout or cart operations.
 * Payload contains only _id — no PII (name, email, role) to minimize leak surface.
 * Role is re-read from DB on every request via req.user (auth middleware).
 */
export const generateToken = (
  user: { _id: string | import("mongoose").Types.ObjectId },
  _type?: "admin" | "user" | "delivery",
): string => {
  const payload: JwtPayload = {
    _id: String(user._id),
  };
  // All user types get 7-day tokens to avoid mid-session expiry during checkout
  const options: SignOptions = { expiresIn: "7d" };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

import { randomInt, createHash } from "crypto";

export const generateOtp = (): string => {
  return String(randomInt(100000, 999999));
};

export const hashOtp = (otp: string): string => {
  return createHash("sha256").update(otp).digest("hex");
};

export const generatePasswordResetToken = (
  email: string,
  otp: string,
): string => {
  const payload: PasswordResetJwtPayload = {
    email,
    otpHash: hashOtp(otp),
    type: "password_reset",
  };
  const options: SignOptions = { expiresIn: "10m" };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyPasswordResetToken = (
  token: string,
): PasswordResetJwtPayload | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "type" in decoded &&
      (decoded as { type: string }).type === "password_reset"
    ) {
      return decoded as PasswordResetJwtPayload;
    }
    return null;
  } catch (error) {
    return null;
  }
};