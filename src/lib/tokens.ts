import { randomBytes, createHash } from "crypto";
import { env } from "../config/env.js";
import RefreshTokenModel from "../models/refreshToken.js";

// ── Refresh Token (opaque, stored hashed in DB) ──
// Admin tokens: 10 days, User tokens: 5 days, Delivery tokens: 5 days
// The createRefreshToken function receives the type, but we use a single
// constant here as a base. Individual callers can override via the expiry param.
const REFRESH_TOKEN_DAYS_ADMIN = 10;
const REFRESH_TOKEN_DAYS_USER = 5;
const REFRESH_TOKEN_DAYS_DELIVERY = 5;

export function generateRefreshTokenValue(): string {
  return randomBytes(64).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getRefreshTokenExpiry(type: "user" | "admin" | "delivery"): Date {
  const days = type === "admin"
    ? REFRESH_TOKEN_DAYS_ADMIN
    : type === "user"
      ? REFRESH_TOKEN_DAYS_USER
      : REFRESH_TOKEN_DAYS_DELIVERY;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function createRefreshToken(
  userId: string,
  type: "user" | "admin" | "delivery",
): Promise<{ tokenValue: string; expiresAt: Date }> {
  const tokenValue = generateRefreshTokenValue();
  const tokenHash = hashToken(tokenValue);
  const expiresAt = getRefreshTokenExpiry(type);

  await RefreshTokenModel.create({ tokenHash, userId, type, expiresAt });

  return { tokenValue, expiresAt };
}

export async function verifyRefreshToken(
  tokenValue: string,
  type: "user" | "admin" | "delivery",
): Promise<{
  userId: string;
  tokenHash: string;
} | null> {
  const tokenHash = hashToken(tokenValue);
  const doc = await RefreshTokenModel.findOne({ tokenHash, type });

  if (!doc) return null;
  if (doc.expiresAt < new Date()) {
    await RefreshTokenModel.deleteOne({ _id: doc._id });
    return null;
  }

  return { userId: String(doc.userId), tokenHash };
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await RefreshTokenModel.deleteOne({ tokenHash });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await RefreshTokenModel.deleteMany({ userId });
}

// ── Cookie config helpers ──

export function accessTokenCookieOptions(_type?: "admin" | "user" | "delivery") {
  const maxAge = 7 * 24 * 60 * 60 * 1000;  // 7 days, matching token expiry
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge,
    path: "/",
  };
}

/**
 * Non-httpOnly version of the access token cookie, readable by client-side
 * JavaScript (js-cookie). Set alongside the httpOnly variant during auto-refresh
 * so `getAuthToken()` on the client sees the new token immediately.
 * This does NOT reduce security: Login.tsx already sets a non-httpOnly userToken
 * via `Cookies.set()`, so this token is already readable by JS in the browser.
 */
export function clientAccessTokenCookieOptions() {
  const maxAge = 7 * 24 * 60 * 60 * 1000;  // 7 days, matching token expiry
  return {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

export function refreshTokenCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    expires: expiresAt,
    path: "/",
  };
}

export function clearAccessTokenCookie() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 0,
    path: "/",
  };
}

export function clearRefreshTokenCookie() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 0,
    path: "/",
  };
}

export function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  };
}

/**
 * Clears the CSRF cookie. Called on admin logout so the next login session
 * starts with a fresh token instead of reusing a stale one from the previous
 * session (which would defeat rotation and could leave a bad token stuck).
 */
export function clearCsrfTokenCookie() {
  return {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 0,
    path: "/",
  };
}
