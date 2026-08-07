/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: User authentication and profile management
 *
 * /api/website/user/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: User registered
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get user profile
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/update-profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update user profile
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               mobile: { type: number }
 *               street: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               pincode: { type: number }
 *               area: { type: string }
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordInput'
 *     responses:
 *       200:
 *         description: Password changed
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordInput'
 *     responses:
 *       200:
 *         description: OTP sent
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpInput'
 *     responses:
 *       200:
 *         description: OTP verified
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordInput'
 *     responses:
 *       200:
 *         description: Password reset
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/verify-user:
 *   post:
 *     tags: [Auth]
 *     summary: Send email verification OTP
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/complete-verify:
 *   post:
 *     tags: [Auth]
 *     summary: Complete email verification
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, otp]
 *             properties:
 *               token: { type: string }
 *               otp: { type: string }
 *     responses:
 *       200:
 *         description: Email verified
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/google-auth-init:
 *   post:
 *     tags: [Auth]
 *     summary: Initialize Google OAuth flow
 *     responses:
 *       200:
 *         description: Google auth URL
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/google-login:
 *   post:
 *     tags: [Auth]
 *     summary: Login/register with Google credential
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GoogleLoginInput'
 *     responses:
 *       200:
 *         description: Login successful
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/google-callback:
 *   post:
 *     tags: [Auth]
 *     summary: Handle Google OAuth callback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GoogleCallbackInput'
 *     responses:
 *       200:
 *         description: Login successful
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/re-login:
 *   post:
 *     tags: [Auth]
 *     summary: Re-login (refresh session)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Session refreshed
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     responses:
 *       200:
 *         description: Token refreshed
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/user/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout user
 *     responses:
 *       200:
 *         description: Logged out
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import {
  registerUser,
  loginUser,
  refreshUserToken,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  verifyOtp,
  verifyUser,
  completeVerify,
  changePassword,
  googleAuthInit,
  googleAuthCallback,
  googleLogin,
  reLogin,
  logoutUser,
} from "../../controller/web/user.controller.js";
import protect, { optionalAuth } from "../../middleware/authMiddleware.js";
import rateLimit from "../../middleware/rateLimit.js";
import { uploadAvatar, uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/register", rateLimit.register, uploadNone, registerUser);
router.post("/login", rateLimit.login, uploadNone, loginUser);
router.get("/profile", protect, getProfile);

router.put(
  "/update-profile",
  rateLimit.updateProfile,
  protect,
  uploadAvatar,
  updateProfile,
);

router.post(
  "/change-password",
  rateLimit.passwordReset,
  protect,
  uploadNone,
  changePassword,
);

router.post(
  "/forgot-password",
  optionalAuth,
  rateLimit.passwordReset,
  uploadNone,
  forgotPassword,
);

router.post("/verify-otp", rateLimit.verifyOtp, uploadNone, verifyOtp);

router.post(
  "/reset-password",
  rateLimit.passwordReset,
  uploadNone,
  resetPassword,
);

router.post("/verify-user", protect, rateLimit.sendEmailOTP, uploadNone, verifyUser);

router.post("/complete-verify", protect, rateLimit.verifyEmail, uploadNone, completeVerify);

router.post("/google-auth-init", rateLimit.googleAuth, uploadNone, googleAuthInit);

router.post("/google-login", rateLimit.googleAuth, uploadNone, googleLogin);

router.post("/google-callback", rateLimit.googleAuth, uploadNone, googleAuthCallback);

router.post("/re-login", protect, uploadNone, reLogin);

router.post("/refresh", rateLimit.refreshToken, uploadNone, refreshUserToken);
router.post("/logout", uploadNone, logoutUser);

export default router;
