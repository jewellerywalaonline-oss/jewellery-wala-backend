import type { Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../../models/user.js";
import { generateToken, generateOtp, generatePasswordResetToken, verifyPasswordResetToken, hashOtp } from "../../lib/jwt.js";
import { hashPassword, comparePassword } from "../../lib/bcrypt.js";
import { sendEmail } from "../../lib/nodemailer.js";
import { uploadToR2 } from "../../lib/cloudflare.js";
import { env } from "../../config/env.js";
import { success, fail } from "../../utils/responses.js";
import { invalidateUserCache } from "../../middleware/authMiddleware.js";
import { logger } from "../../lib/logger.js";
import {
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  accessTokenCookieOptions,
  clientAccessTokenCookieOptions,
  refreshTokenCookieOptions,
  clearAccessTokenCookie,
  clearRefreshTokenCookie,
} from "../../lib/tokens.js";
import { verifyTurnstileToken } from "../../lib/turnstile.js";

const OAUTH_STATE_SECRET = env.JWT_SECRET + "_oauth_state";
const OAUTH_STATE_EXPIRY = "10m";

/** Sign a state token so it survives server restarts */
function signOAuthState(): string {
  return jwt.sign({ t: Date.now() }, OAUTH_STATE_SECRET, { expiresIn: OAUTH_STATE_EXPIRY });
}

/** Verify and consume a state token. Returns true if valid. */
function verifyOAuthState(state: string): boolean {
  try {
    const decoded = jwt.verify(state, OAUTH_STATE_SECRET);
    return typeof decoded === "object" && decoded !== null && "t" in decoded;
  } catch {
    return false;
  }
}

/** Helper: set access + refresh token cookies for a user session.
 * Returns the generated access token so callers can reuse it without calling generateToken again. */
async function setSessionCookies(
  res: Response,
  user: { _id: string | import("mongoose").Types.ObjectId },
  type: "user",
): Promise<string> {
  const accessToken = generateToken(user, "user");
  const refresh = await createRefreshToken(String(user._id), type);

  // httpOnly cookie for server-side auth
  res.cookie("userToken", accessToken, accessTokenCookieOptions("user"));
  // non-httpOnly cookie so client-side js-cookie (getAuthToken()) sees the new token
  res.cookie("userToken_client", accessToken, clientAccessTokenCookieOptions());
  res.cookie(
    "userRefreshToken",
    refresh.tokenValue,
    refreshTokenCookieOptions(refresh.expiresAt),
  );

  return accessToken;
}

/** Helper: clear all session cookies */
function clearSessionCookies(res: Response): void {
  res.cookie("userToken", "", clearAccessTokenCookie());
  res.cookie("userToken_client", "", clearAccessTokenCookie());
  res.cookie("userRefreshToken", "", clearRefreshTokenCookie());
  res.cookie("adminToken", "", clearAccessTokenCookie());
  res.cookie("adminToken_client", "", clearAccessTokenCookie());
  res.cookie("adminRefreshToken", "", clearRefreshTokenCookie());
  res.cookie("deliveryToken", "", clearAccessTokenCookie());
  res.cookie("deliveryRefreshToken", "", clearRefreshTokenCookie());
}

export const registerUser = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  if (!req.body) {
    return fail(res, "All fields are required", 400);
  }
  try {
    const { name, email, password, turnstileToken } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      turnstileToken?: string;
    };

    // ── Turnstile bot verification ───────────────────────────────
    if (env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return fail(res, "Bot verification failed. Please complete the security check.", 400);
      }
      const valid = await verifyTurnstileToken(turnstileToken);
      if (!valid) {
        return fail(res, "Bot verification failed. Please try again.", 400);
      }
    }

    if (!name || !email || !password) {
      return fail(res, "All fields are required", 400);
    }

    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing) {
      return fail(res, "User already exists", 409);
    }

    const hashed = await hashPassword(password);
    const newUser = await User.create({
      name,
      email,
      password: hashed,
    });

    const userData = newUser.toObject();
    delete (userData as { password?: string }).password;

    const accessToken = await setSessionCookies(res, newUser, "user");

    return res.status(201).json({
      _status: true,
      _message: "User registered successfully",
      _data: userData,
      _token: accessToken,
    });
  } catch (error) {
    logger.error({ err: error }, "Register user error");
    return fail(res, "Internal Server Error", 500);
  }
};

/**
 * Calculate exponential backoff lock duration based on failed attempt count.
 * Returns lock duration in milliseconds.
 *  5 failures → 1 minute
 *  6-7      → 5 minutes
 *  8-9      → 30 minutes
 *  10+      → 2 hours
 */
function getLockDurationMs(attempts: number): number {
  if (attempts >= 10) return 2 * 60 * 60 * 1000;
  if (attempts >= 8) return 30 * 60 * 1000;
  if (attempts >= 6) return 5 * 60 * 1000;
  return 1 * 60 * 1000;
}

export const loginUser = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  if (!req.body) {
    return fail(res, "Email and password are required", 400);
  }
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };
    if (!email || !password) {
      return fail(res, "All fields are required", 400);
    }

    // Fetch user with selectable fields — need password, failedLoginAttempts, lockedUntil
    const user = await User.findOne({ email })
      .select("password name email avatar gender mobile role status isEmailVerified isMobileVerified failedLoginAttempts lockedUntil")
      .lean();

    if (!user) {
      return fail(res, "Invalid email or password", 401);
    }

    // ── Account lockout check ──
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return fail(
        res,
        `Account temporarily locked due to too many failed login attempts. Please try again in ${remainingMin} minute${remainingMin > 1 ? "s" : ""}.`,
        429,
      );
    }

    // Check password
    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      // Increment failed attempts and set lockout if threshold reached
      const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const update: Record<string, unknown> = { failedLoginAttempts: newAttempts };

      if (newAttempts >= 5) {
        update.lockedUntil = new Date(Date.now() + getLockDurationMs(newAttempts));
      }

      await User.updateOne({ _id: user._id }, { $set: update });

      return fail(res, "Invalid email or password", 401);
    }

    // Successful login — reset lockout fields
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 0, lockedUntil: null } },
    );

    const userData = { ...user };
    delete (userData as { password?: string; googleId?: string }).password;
    delete (userData as { password?: string; googleId?: string }).googleId;
    delete (userData as Record<string, unknown>).failedLoginAttempts;
    delete (userData as Record<string, unknown>).lockedUntil;

    const accessToken = await setSessionCookies(res, user, "user");

    return res.status(200).json({
      _status: true,
      _message: "User logged in successfully",
      _data: userData,
      _token: accessToken,
    });
  } catch (error) {
    logger.error({ err: error }, "Login user error");
    return fail(res, "Internal Server Error", 500);
  }
};

export const refreshUserToken = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const refreshValue = req.cookies?.userRefreshToken;
  if (!refreshValue) {
    return fail(res, "No refresh token", 401);
  }

  try {
    const result = await verifyRefreshToken(refreshValue, "user");
    if (!result) {
      clearSessionCookies(res);
      return fail(res, "Session expired, please log in again", 401);
    }

    // Rotate refresh token
    await revokeRefreshToken(result.tokenHash);

    const user = await User.findById(result.userId).select("_id name email deletedAt").lean();
    if (!user || user.deletedAt) {
      clearSessionCookies(res);
      return fail(res, "User not found or deactivated", 401);
    }

    const newAccessToken = await setSessionCookies(res, user, "user");

    return res.status(200).json({
      _status: true,
      _message: "Token refreshed successfully",
      _token: newAccessToken,
    });
  } catch (error) {
    logger.error({ err: error }, "Refresh token error");
    clearSessionCookies(res);
    return fail(res, "Session expired, please log in again", 401);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  if (!req.user) return fail(res, "Unauthorized", 401);
  try {
    const profileData = { ...(req.user as Record<string, unknown> | undefined) };
    const { createdAt, updatedAt, deletedAt, ...rest } = profileData;
    return success(res, rest, "User profile Found");
  } catch (error) {
    logger.error({ err: error }, "Get profile error");
    return fail(res, "Internal Server Error", 500);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  if (!req.user) return fail(res, "Unauthorized", 401);
  try {
    const user = await User.findById(req.user._id).select("password");
    if (!user) return fail(res, "User not found", 404);

    const { oldPassword, newPassword } = req.body as {
      oldPassword?: string;
      newPassword?: string;
    };
    if (!oldPassword || !newPassword) {
      return fail(res, "Old and new password are required", 400);
    }

    // Enforce minimum password strength
    if (newPassword.length < 6) {
      return fail(res, "New password must be at least 6 characters long", 400);
    }

    const isMatch = await comparePassword(oldPassword, user.password);
    if (!isMatch) return fail(res, "Incorrect password", 401);

    user.password = await hashPassword(newPassword);
    await user.save();

    // Revoke all existing refresh tokens so other sessions are forced to re-login
    await revokeAllUserRefreshTokens(String(user._id));

    return success(res, null, "Password changed successfully");
  } catch (error) {
    logger.error({ err: error }, "Change password error");
    return fail(res, "Internal Server Error", 500);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  if (!req.user) return fail(res, "Unauthorized", 401);
  try {
    const user = await User.findById(req.user._id);
    if (!user) return fail(res, "User not found", 404);

    let avatarUrl: string | null = user.avatar ?? null;
    if (req.file) {
      try {
        const result = await uploadToR2(req.file, "avatars", 80, user.name || undefined);
        avatarUrl = result.url;
      } catch (uploadError) {
        logger.error({ err: uploadError }, "Avatar upload error");
        return fail(res, "Failed to upload avatar", 500);
      }
    }

    const body = req.body as Record<string, string | undefined>;

    if (body.name) user.name = body.name;
    if (body.address) {
      try {
        user.address = JSON.parse(body.address);
      } catch {
        // ignore parse errors silently — falls through to individual fields
      }
    }
    if (body.mobile) user.mobile = Number(body.mobile as string);
    if (body.gender) user.gender = body.gender as "male" | "female" | "other";

    if (body.pincode || body.street || body.city || body.state || body.area || body.instructions) {
      if (!user.address) user.address = { state: "", city: "", street: "", area: "", instructions: "" };
      if (body.pincode) user.address.pincode = Number(body.pincode as string);
      if (body.street) user.address.street = body.street;
      if (body.city) user.address.city = body.city;
      if (body.state) user.address.state = body.state;
      if (body.area) user.address.area = body.area;
      if (body.instructions) user.address.instructions = body.instructions;
    }

    user.avatar = avatarUrl;
    await user.save();

    invalidateUserCache(user._id);

    const profileData = user.toObject();
    const { createdAt, updatedAt, deletedAt, ...rest } = profileData;
    return success(res, rest, "User profile updated successfully");
  } catch (error) {
    logger.error({ err: error }, "Update profile error");
    return fail(res, "Internal Server Error", 500);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Logged-in users always reset their own account — the email entered in the
  // body is ignored so they can't trigger a reset OTP for an arbitrary address.
  const sessionEmail = (req.user as { email?: string } | undefined)?.email;
  const bodyEmail = (req.body as { email?: string } | undefined)?.email;

  if (!sessionEmail && !bodyEmail) {
    fail(res, "Email is required", 400);
    return;
  }

  // Match the existing login/register lookup behavior: emails are stored and
  // compared case-sensitively in Mongo, so DON'T lowercase here or users who
  // registered with mixed-case emails would silently fail the lookup.
  const email = (sessionEmail ?? bodyEmail ?? "").trim();

  try {
    // Exclude soft-deleted accounts — consistent with resetPassword which
    // already rejects user.deletedAt with "Account not found or deactivated".
    const user = await User.findOne({ email, deletedAt: null })
      .select("name")
      .lean();
    if (!user) {
      // For guests, stay silent about whether the account exists so we don't
      // leak which emails are registered (anti-enumeration). A logged-in
      // session that no longer maps to an account is a genuine error.
      if (sessionEmail) {
        fail(res, "Account not found. Please log in again.", 404);
        return;
      }
      success(
        res,
        null,
        "We have sent you an OTP to your email. Please check your email to reset your password.",
      );
      return;
    }

    const otp = generateOtp();
    const token = generatePasswordResetToken(email, otp);

    res.status(200).json({
      _status: true,
      _message: "OTP sent to your email",
      _token: token,
    });

    sendEmail(email, "passwordReset", {
      otp,
      subject: "Your Password Reset OTP",
      name: user.name || "User",
    }).catch((emailError) => {
      logger.error({ err: emailError }, "Failed to send OTP email");
    });

    return;
  } catch (error) {
    logger.error({ err: error }, "Forgot password error");
    fail(res, "Internal Server Error", 500);
    return;
  }
};

export const verifyOtp = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  if (!req.body || !req.body.otp || !req.body.token) {
    return fail(res, "OTP and token are required", 400);
  }

  try {
    const { otp, token } = req.body as { otp?: string; token?: string };
    const decoded = verifyPasswordResetToken(token!);
    if (!decoded || decoded.type !== "password_reset") {
      return fail(res, "Invalid or expired attempt", 400);
    }
    if (decoded.otpHash !== hashOtp(otp!)) {
      return fail(res, "Invalid OTP", 400);
    }

    const newToken = generatePasswordResetToken(decoded.email, otp!);
    return res.status(200).json({
      _status: true,
      _message: "OTP verified successfully",
      _token: newToken,
    });
  } catch (error) {
    logger.error({ err: error }, "OTP verification error");
    return fail(res, "Internal Server Error", 500);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token) return fail(res, "Reset token is required", 400);
    if (!newPassword) return fail(res, "newPassword is required", 400);
    if (newPassword.length < 6) return fail(res, "Password must be at least 6 characters", 400);

    const decoded = verifyPasswordResetToken(token);
    if (!decoded || decoded.type !== "password_reset") {
      return fail(res, "Invalid or expired reset token. Please request a new OTP.", 400);
    }

    const user = await User.findOne({ email: decoded.email }).select("_id email deletedAt").lean();
    if (!user || user.deletedAt) {
      return fail(res, "Account not found or deactivated", 404);
    }

    const updated = await User.findByIdAndUpdate(
      user._id,
      { password: await hashPassword(newPassword) },
      { new: true, runValidators: true },
    );
    if (!updated) return fail(res, "Account Not Found", 404);

    // Revoke all sessions on password reset
    await revokeAllUserRefreshTokens(String(user._id));
    clearSessionCookies(res);

    return success(res, null, "Password reset successfully");
  } catch (error) {
    logger.error({ err: error }, "Reset password error");
    return fail(res, "Internal Server Error", 500);
  }
};

export const verifyUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!req.user) {
    fail(res, "Unauthorized", 401);
    return;
  }

  try {
    const user = req.user;
    if (user.isEmailVerified) {
      fail(res, "Your account is already verified", 200);
      return;
    }

    const email = user.email;
    const otp = generateOtp();

    const verificationToken = jwt.sign(
      {
        email,
        otp,
        type: "email_verification",
        userId: user._id,
      },
      env.JWT_SECRET,
      { expiresIn: "10m" } as SignOptions,
    );

    res.status(200).json({
      _status: true,
      _message: "Verification email sent successfully",
      _token: verificationToken,
    });

    sendEmail(email, "verifyEmail", {
      otp,
      subject: "Verify Your Email",
      name: user.name || "User",
      verificationLink: `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
    }).catch((emailError) => {
      logger.error({ err: emailError }, "Failed to send verification email");
    });
  } catch (error) {
    logger.error({ err: error }, "Verify user error");
    fail(res, "Internal Server Error", 500);
    return;
  }
};

export const completeVerify = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { token, otp } = req.body as { token?: string; otp?: string };
  if (!token || !otp) {
    return fail(res, "Token and OTP are required", 400);
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      type?: string;
      otp?: string;
      userId?: string;
    };

    if (decoded.type !== "email_verification") {
      return fail(res, "Invalid verification token", 400);
    }
    if (decoded.otp !== otp) {
      return fail(res, "Invalid OTP", 400);
    }

    if (!decoded.userId) {
      return fail(res, "Invalid verification token: missing user ID", 400);
    }

    const result = await User.findByIdAndUpdate(
      decoded.userId,
      { isEmailVerified: true },
      { new: true },
    );
    if (!result) return fail(res, "User not found", 404);
    invalidateUserCache(decoded.userId);
    return success(res, null, "Email verified successfully");
  } catch (error) {
    logger.error({ err: error }, "Complete verify error");
    if (error instanceof Error && error.name === "TokenExpiredError") {
      return fail(res, "Verification link has expired. Please request a new one.", 400);
    }
    return fail(res, "Internal Server Error", 500);
  }
};

export const googleAuthInit = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  const state = signOAuthState();

  if (!env.GOOGLE_CLIENT_ID) {
    return fail(res, "Google authentication is not configured", 500);
  }

  const redirectUri = `${env.FRONTEND_URL}/auth/google/callback`;
  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(env.GOOGLE_CLIENT_ID)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent("email profile")}&` +
    `access_type=offline&` +
    `state=${encodeURIComponent(state)}&` +
    `prompt=select_account`;

  return res.status(200).json({ _status: true, _state: state, _url: googleAuthUrl });
};

const buildGooglePayload = (
  payload: { email?: string; name?: string; picture?: string; sub?: string },
) => {
  const { email, name, picture: avatar, sub: googleId } = payload;
  if (!email || !googleId) return null;
  return { email, name, avatar, googleId };
};

export const googleLogin = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { credential } = req.body as { credential?: string };
    if (!credential) {
      return fail(res, "Google credential is required", 400);
    }

    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() ?? {};
    const parsed = buildGooglePayload(payload);
    if (!parsed) return fail(res, "Email not found in Google account", 400);

    let user = await User.findOne({
      $or: [{ email: parsed.email }, { googleId: parsed.googleId }],
    });

    if (!user) {
      user = await User.create({
        name: parsed.name,
        email: parsed.email,
        password: await hashPassword(Math.random().toString(36).slice(-8)),
        avatar: parsed.avatar,
        googleId: parsed.googleId,
        isEmailVerified: true,
        status: true,
      });
    } else if (!user.status) {
      return fail(res, "Your account has been deactivated. Please contact support.", 403);
    } else if (!user.googleId) {
      user.googleId = parsed.googleId;
      user.isEmailVerified = true;
      if (!user.avatar) user.avatar = parsed.avatar;
      await user.save();
    }

    const userData = user.toObject();
    const { password, googleId, createdAt, updatedAt, deletedAt, ...cleanData } = userData;

    const accessToken = await setSessionCookies(res, user, "user");

    return res.status(200).json({
      _status: true,
      _message: "Login successful",
      _data: { user: cleanData },
      _token: accessToken,
    });
  } catch (error) {
    logger.error({ err: error }, "Google login error");
    return fail(res, "Error during Google authentication", 500);
  }
};

export const googleAuthCallback = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { code, state } = req.body as { code?: string; mobile?: string; state?: string };
    if (!code) {
      return fail(res, "Authorization code is required", 400);
    }
    if (!state || !verifyOAuthState(state)) {
      return fail(res, "Invalid OAuth state. Possible CSRF attack.", 400);
    }

    const client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      `${env.FRONTEND_URL}/auth/google/callback`,
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token ?? "",
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() ?? {};
    const parsed = buildGooglePayload(payload);
    if (!parsed) return fail(res, "Email not found in Google account", 400);

    let user = await User.findOne({
      $or: [{ email: parsed.email }, { googleId: parsed.googleId }],
    });

    if (!user) {
      user = await User.create({
        name: parsed.name,
        email: parsed.email,
        password: await hashPassword(Math.random().toString(36).slice(-8)),
        avatar: parsed.avatar,
        googleId: parsed.googleId,
        isEmailVerified: true,
        status: true,
      });
    } else if (!user.status) {
      return fail(res, "Your account has been deactivated. Please contact support.", 403);
    } else if (!user.googleId) {
      user.googleId = parsed.googleId;
      user.isEmailVerified = true;
      if (!user.avatar) user.avatar = parsed.avatar;
      await user.save();
    }

    const userData = user.toObject();
    const { password, googleId, createdAt, updatedAt, deletedAt, ...cleanData } = userData;

    const accessToken = await setSessionCookies(res, user, "user");

    return res.status(200).json({
      _status: true,
      _message: "Login successful",
      _data: { user: cleanData },
      _token: accessToken,
    });
  } catch (error) {
    logger.error({ err: error }, "Google auth callback error");
    return fail(res, "Error during Google authentication", 500);
  }
};

export const reLogin = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    if (!req.user) return fail(res, "Unauthorized", 401);

    await setSessionCookies(res, req.user, "user");

    return res.status(200).json({
      _status: true,
      _message: "Login successful",
    });
  } catch (error) {
    logger.error({ err: error }, "Re-login error");
    return fail(res, "Error during re-login", 500);
  }
};

export const logoutUser = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  // Revoke refresh token if present
  const refreshValue = req.cookies?.userRefreshToken;
  if (refreshValue) {
    try {
      const { hashToken } = await import("../../lib/tokens.js");
      const tokenHash = hashToken(refreshValue);
      await revokeRefreshToken(tokenHash);
    } catch {
      // Ignore revocation errors — clear cookies anyway
    }
  }

  clearSessionCookies(res);

  return res.status(200).json({
    _status: true,
    _message: "Logged out successfully",
  });
};
