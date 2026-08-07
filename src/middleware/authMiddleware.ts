import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User from "../models/user.js";
import { env } from "../config/env.js";
import type { JwtPayload } from "../types/jwt.js";
import { generateToken } from "../lib/jwt.js";
import cache from "../lib/cache.js";
import {
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  accessTokenCookieOptions,
  clientAccessTokenCookieOptions,
  refreshTokenCookieOptions,
  clearRefreshTokenCookie,
} from "../lib/tokens.js";

const USER_CACHE_TTL = 30; // seconds — short enough to avoid stale data, long enough to skip repeated lookups
const userCacheKey = (id: string): string => `user_${id}`;

/** Cache-aware user lookup. Returns cached user if fresh, otherwise fetches from DB. */
async function getCachedUser(userId: string) {
  const cacheKey = userCacheKey(userId);
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached as Record<string, unknown>;
  const user = await User.findById(userId).select("-password -googleId -avatarFileName -avatarFileId -updatedAt -__v").lean();
  if (user) {
    cache.set(cacheKey, user, USER_CACHE_TTL);
  }
  return user;
}

/** Invalidate cached user data so the next lookup fetches fresh from DB. */
export function invalidateUserCache(userId: string | import("mongoose").Types.ObjectId): void {
  cache.del(userCacheKey(String(userId)));
}

const extractAndVerifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
  token: string,
): Promise<void> => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await getCachedUser(decoded._id);
    if (user) {
      req.user = user;
    }
    next();
  } catch (error) {
    // JWT expired — try to refresh using the refresh token cookie
    console.log(error);
    if (
      error instanceof Error &&
      (error.name === "TokenExpiredError" ||
        (error as jwt.JsonWebTokenError).name === "TokenExpiredError")
    ) {
      try {
        await attemptAutoRefresh(req, res, next);
        return;
      } catch {
        // fall through to 401
      }
    }

    if (!res.headersSent) {
      res.status(401).json({
        _status: false,
        _message: "Not authorized, token expired",
      });
    }
  }
};

/**
 * Attempt to auto-refresh the access token using the refresh token cookie.
 * The proactive refresh (admin panel every 10 min, website every 10 min)
 * prevents the race condition of multiple parallel auto-refresh attempts,
 * so this function can be kept simple without a distributed lock.
 */
async function attemptAutoRefresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userRefresh = req.cookies?.userRefreshToken;
  const adminRefresh = req.cookies?.adminRefreshToken;

  let refreshValue: string | undefined;
  let tokenType: "user" | "admin" | undefined;

  if (userRefresh) {
    refreshValue = userRefresh;
    tokenType = "user";
  } else if (adminRefresh) {
    refreshValue = adminRefresh;
    tokenType = "admin";
  }

  if (!refreshValue || !tokenType) {
    res.status(401).json({
      _status: false,
      _message: "Not authorized, no valid session",
    });
    return;
  }

  const result = await verifyRefreshToken(refreshValue, tokenType);
  if (!result) {
    res.cookie(
      tokenType === "user" ? "userRefreshToken" : "adminRefreshToken",
      "",
      clearRefreshTokenCookie(),
    );
    res.status(401).json({
      _status: false,
      _message: "Session expired, please log in again",
    });
    return;
  }

  // Revoke old refresh token (rotation)
  await revokeRefreshToken(result.tokenHash);

  const user = await getCachedUser(result.userId);
  if (!user || user.deletedAt) {
    res.status(401).json({
      _status: false,
      _message: "User not found or deactivated",
    });
    return;
  }

  // Use spread to convert user to a plain object (handles both plain objects and Mongoose documents)
  const userPlain = { ...user } as Record<string, unknown> & { _id: string | import("mongoose").Types.ObjectId };
  const newAccessToken = generateToken(userPlain, tokenType);
  const newRefresh = await createRefreshToken(String(user._id), tokenType);

  const accessCookieName = tokenType === "user" ? "userToken" : "adminToken";
  const clientCookieName = tokenType === "user" ? "userToken_client" : "adminToken_client";
  const refreshCookieName =
    tokenType === "user" ? "userRefreshToken" : "adminRefreshToken";

  // Set httpOnly cookies for server-side auth
  res.cookie(
    accessCookieName,
    newAccessToken,
    accessTokenCookieOptions(tokenType),
  );
  // Set non-httpOnly cookie so client-side js-cookie (getAuthToken()) sees the new token
  res.cookie(
    clientCookieName,
    newAccessToken,
    clientAccessTokenCookieOptions(),
  );
  res.cookie(
    refreshCookieName,
    newRefresh.tokenValue,
    refreshTokenCookieOptions(newRefresh.expiresAt),
  );

  req.user = user;
  next();
}

const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
    if (!token) {
      res.status(401).json({
        _status: false,
        _message: "Not authorized, no token",
      });
      return;
    }
    await extractAndVerifyToken(req, res, next, token);
    return;
  }

  // Fallback: check httpOnly cookies
  token = req.cookies?.adminToken || req.cookies?.userToken;
  if (token) {
    await extractAndVerifyToken(req, res, next, token);
    return;
  }

  res.status(401).json({
    _status: false,
    _message: "Not authorized, no token",
  });
};

/**
 * Optional authentication — populates `req.user` when a valid token is
 * present (Bearer header or cookie), but never blocks the request.
 * Used by endpoints like forgot-password that behave differently for
 * logged-in users (e.g. reset the logged-in account's own password
 * instead of accepting an arbitrary email from the request body).
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      token = req.cookies?.adminToken || req.cookies?.userToken;
    }

    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const user = await getCachedUser(decoded._id);
      if (user) {
        req.user = user;
      }
    }
  } catch {
    // Invalid/expired token — treat as unauthenticated, never block
  }

  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        _status: false,
        _message: "Not authorized, no user",
      });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({
        _status: false,
        _message: "Forbidden: insufficient permissions",
      });
      return;
    }
    next();
  };
};

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  const csrfCookie = req.cookies?.csrfToken;
  const csrfHeader = req.headers["x-csrf-token"] as string | undefined;

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({
      _status: false,
      _message: "Invalid CSRF token",
    });
    return;
  }

  next();
};

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      _status: false,
      _message: "Not authorized, no user",
    });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({
      _status: false,
      _message: "Forbidden: admin access required",
    });
    return;
  }
  next();
};

export default protect;
