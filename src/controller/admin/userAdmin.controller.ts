import type { Request, Response } from "express";
import { generateToken } from "../../lib/jwt.js";
import userModel from "../../models/user.js";
import { logger } from "../../lib/logger.js";
import Cart from "../../models/cart.js";
import Order from "../../models/order.js";
import Wishlist from "../../models/wishlist.js";
import Reviews from "../../models/review.js";
import auditLogModel from "../../models/auditLog.js";
import { invalidateUserCache } from "../../middleware/authMiddleware.js";
import { comparePassword, hashPassword } from "../../lib/bcrypt.js";
import {
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  accessTokenCookieOptions,
  clientAccessTokenCookieOptions,
  refreshTokenCookieOptions,
  clearAccessTokenCookie,
  clearRefreshTokenCookie,
  clearCsrfTokenCookie,
  hashToken,
} from "../../lib/tokens.js";

/** Helper: set admin session cookies */
async function setSessionCookies(
  res: Response,
  user: { _id: string | import("mongoose").Types.ObjectId },
): Promise<void> {
  const accessToken = generateToken(user, "admin");
  const refresh = await createRefreshToken(String(user._id), "admin");

  // httpOnly cookie for server-side auth
  res.cookie("adminToken", accessToken, accessTokenCookieOptions("admin"));
  // non-httpOnly cookie so client-side js-cookie sees the new token
  res.cookie("adminToken_client", accessToken, clientAccessTokenCookieOptions());
  res.cookie("adminRefreshToken", refresh.tokenValue, refreshTokenCookieOptions(refresh.expiresAt));
}

function clearSessionCookiesAdmin(res: Response): void {
  res.cookie("adminToken", "", clearAccessTokenCookie());
  res.cookie("adminToken_client", "", clearAccessTokenCookie());
  res.cookie("adminRefreshToken", "", clearRefreshTokenCookie());
  // Drop the CSRF token too so the next login session starts fresh instead of
  // reusing a stale token from the previous session.
  res.cookie("csrfToken", "", clearCsrfTokenCookie());
}

export const login = async (req: Request, res: Response): Promise<void> => {
  if (!req.body) {
    res.status(400).json({ _status: false, _message: "No data provided" });
    return;
  }
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ _status: false, _message: "Email and password are required" });
      return;
    }
    const user = await userModel.findOne({ email, role: "admin" })
      .select("_id email password role name failedLoginAttempts lockedUntil")
      .lean();
    if (!user) {
      res.status(401).json({ _status: false, _message: "Invalid credentials" });
      return;
    }

    // ── Account lockout check ──
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      res.status(429).json({
        _status: false,
        _message: `Account temporarily locked due to too many failed login attempts. Please try again in ${remainingMin} minute${remainingMin > 1 ? "s" : ""}.`,
      });
      return;
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      // Increment failed attempts and set lockout if threshold reached
      const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const update: Record<string, unknown> = { failedLoginAttempts: newAttempts };

      if (newAttempts >= 5) {
        const durations: Record<number, number> = {
          5: 60 * 1000,        // 1 minute
          6: 5 * 60 * 1000,     // 5 minutes
          7: 5 * 60 * 1000,
          8: 30 * 60 * 1000,   // 30 minutes
          9: 30 * 60 * 1000,
        };
        const lockMs = newAttempts >= 10 ? 2 * 60 * 60 * 1000 : (durations[newAttempts] ?? 5 * 60 * 1000);
        update.lockedUntil = new Date(Date.now() + lockMs);
      }

      await userModel.updateOne({ _id: user._id }, { $set: update });

      res.status(401).json({ _status: false, _message: "Invalid credentials" });
      return;
    }

    // Successful login — reset lockout fields
    await userModel.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 0, lockedUntil: null } },
    );

    await setSessionCookies(res, user);

    res.status(200).json({
      _status: true,
      _message: "Admin logged in successfully",
    });
  } catch (error) {
    logger.error({ err: error }, "Admin login error");
    res.status(500).json({ _status: false, _message: "Internal Server Error" });
  }
};

export const refreshAdminToken = async (req: Request, res: Response): Promise<void> => {
  const refreshValue = req.cookies?.adminRefreshToken;
  if (!refreshValue) {
    res.status(401).json({ _status: false, _message: "No refresh token" });
    return;
  }

  try {
    const result = await verifyRefreshToken(refreshValue, "admin");
    if (!result) {
      clearSessionCookiesAdmin(res);
      res.status(401).json({ _status: false, _message: "Session expired, please log in again" });
      return;
    }

    await revokeRefreshToken(result.tokenHash);

    const user = await userModel.findById(result.userId)
      .select("_id name email deletedAt")
      .lean();
    if (!user || user.deletedAt) {
      clearSessionCookiesAdmin(res);
      res.status(401).json({ _status: false, _message: "User not found or deactivated" });
      return;
    }

    await setSessionCookies(res, user);

    res.status(200).json({ _status: true, _message: "Token refreshed successfully" });
  } catch (error) {
    logger.error({ err: error }, "Admin refresh error");
    clearSessionCookiesAdmin(res);
    res.status(401).json({ _status: false, _message: "Session expired" });
  }
};

export const findAllUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const isDeletedAt = (req.body?.isDeletedAt ?? req.query?.isDeletedAt) as string | undefined;

    const query: Record<string, unknown> = {};
    if (isDeletedAt === "all") {
      // no deletedAt filter — show everything
    } else if (isDeletedAt === "deleted") {
      query.deletedAt = { $ne: null };
    } else {
      query.deletedAt = null;
    }

    const users = await userModel.find(query).lean();
    res.status(200).json({
      _status: true,
      _message: "Users found successfully",
      _data: users,
    });
  } catch (error) {
    logger.error({ err: error }, "findAllUser error");
    res.status(500).json({ _status: false, _message: "Internal Server Error" });
  }
};

export const getFullDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const [user, cart, orders, wishlist, reviews] = await Promise.all([
      userModel.findById(req.params.id).select("-password").lean(),
      Cart.find({ user: req.params.id })
        .populate("items.product", "name images image discount_price price slug")
        .populate("items.color", "name code")
        .lean(),
      Order.find({ userId: String(req.params.id) })
        .populate("items.productId", "name images slug")
        .select("-payment.razorpay.signature")
        .lean(),
      Wishlist.find({ user: req.params.id })
        .populate("products", "name price discount_price image images slug stock")
        .lean(),
      Reviews.find({ userId: req.params.id })
        .populate("productId", "name images slug")
        .lean(),
    ]);
    res.status(200).json({
      _status: true,
      _message: "User details found",
      _user: user,
      _cart: cart,
      _orders: orders,
      _wishlist: wishlist,
      _reviews: reviews,
    });
  } catch (error) {
    logger.error({ err: error }, "getFullDetails error");
    res.status(500).json({ _status: false, _message: "Internal Server Error" });
  }
};

export const logout = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Revoke refresh token if present
  const refreshValue = req.cookies?.adminRefreshToken;
  if (refreshValue) {
    try {
      const tokenHash = hashToken(refreshValue);
      await revokeRefreshToken(tokenHash);
    } catch {
      // Ignore revocation errors — clear cookies anyway
    }
  }

  clearSessionCookiesAdmin(res);
  res.status(200).json({
    _status: true,
    _message: "Admin logged out successfully",
  });
};

export const changeRole = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role?: string };
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({ _status: false, _message: "Not authorized" });
      return;
    }

    if (String(requestingUser._id) === id && role !== "admin") {
      res.status(403).json({ _status: false, _message: "Cannot change your own role" });
      return;
    }

    const user = await userModel.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true },
    );

    if (!user) {
      res.status(404).json({ _status: false, _message: "User not found" });
      return;
    }

    logger.info(
      { action: "role_change", admin: requestingUser.email, target: user.email, newRole: role },
      "Admin changed user role",
    );

    invalidateUserCache(user._id);

    auditLogModel.create({
      action: "role_change",
      adminId: requestingUser._id,
      adminEmail: requestingUser.email,
      targetId: user._id,
      targetEmail: user.email,
      details: { roleBefore: user.role, roleAfter: role },
      ip: req.ip,
    }).catch((err) =>
      logger.error({ err }, "Failed to create audit log"),
    );

    res.status(200).json({
      _status: true,
      _message: "User role updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error in changeRole");
    res.status(500).json({ _status: false, _message: "Error updating user role" });
  }
};

export const verifyPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { password } = req.body as { password?: string };
    const requestingUser = req.user;

    if (!requestingUser) {
      res.status(401).json({ _status: false, _message: "Not authorized" });
      return;
    }

    if (!password) {
      res.status(400).json({ _status: false, _message: "Password is required" });
      return;
    }

    const user = await userModel.findById(requestingUser._id).select("password");
    if (!user) {
      res.status(404).json({ _status: false, _message: "User not found" });
      return;
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      res.status(403).json({ _status: false, _message: "Incorrect password" });
      return;
    }

    auditLogModel.create({
      action: "login",
      adminId: requestingUser._id,
      adminEmail: requestingUser.email,
      details: { purpose: "role_change_verification" },
      ip: req.ip,
    }).catch((err) =>
      logger.error({ err }, "Failed to create audit log"),
    );

    res.status(200).json({
      _status: true,
      _message: "Password verified successfully",
    });
  } catch (error) {
    logger.error({ err: error }, "Error in verifyPassword");
    res.status(500).json({ _status: false, _message: "Error verifying password" });
  }
};

export const createUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!name || !email || !password) {
      res.status(400).json({ _status: false, _message: "Name, email, and password are required" });
      return;
    }

    const existing = await userModel.findOne({ email }).select("_id").lean();
    if (existing) {
      res.status(409).json({ _status: false, _message: "A user with this email already exists" });
      return;
    }

    const hashed = await hashPassword(password);
    const user = await userModel.create({
      name,
      email,
      password: hashed,
      role: role || "user",
    });

    res.status(201).json({
      _status: true,
      _message: "User created successfully",
      _data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error in createUser");
    res.status(500).json({ _status: false, _message: "Error creating user" });
  }
};

export const userDelete = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = String(req.params.id);
    const user = await userModel.findById(userId)
      .select("_id email role")
      .lean();

    if (!user) {
      res.status(404).json({ _status: false, _message: "User not found" });
      return;
    }

    // Clean up refresh tokens for deleted user
    const { revokeAllUserRefreshTokens } = await import("../../lib/tokens.js");
    await revokeAllUserRefreshTokens(userId);

    invalidateUserCache(userId);
    await userModel.findByIdAndDelete(userId);

    res.status(200).json({ _status: true, _message: "User permanently deleted successfully" });

    const requestingUser = req.user;
    if (requestingUser) {
      auditLogModel.create({
        action: "user_delete",
        adminId: requestingUser._id,
        adminEmail: requestingUser.email,
        targetId: user._id,
        targetEmail: user.email,
        details: { role: user.role },
        ip: req.ip,
      }).catch((err) =>
        logger.error({ err }, "Failed to create audit log"),
      );
    }
  } catch (error) {
    logger.error({ err: error }, "Error in userDelete");
    res.status(500).json({ _status: false, _message: "Error deleting user" });
  }
};
