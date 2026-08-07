/**
 * @openapi
 * tags:
 *   - name: Admin - Auth & Users
 *     description: Admin authentication and user management
 *
 * /api/admin/user/login:
 *   post:
 *     tags: [Admin - Auth & Users]
 *     summary: Admin login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginInput'
 *     responses:
 *       200:
 *         description: Admin logged in successfully
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
 * /api/admin/user/refresh:
 *   post:
 *     tags: [Admin - Auth & Users]
 *     summary: Refresh admin access token
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
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
 * /api/admin/user/findAllUser:
 *   post:
 *     tags: [Admin - Auth & Users]
 *     summary: Get all users (paginated)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: User list
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/user/get-full-details/{id}:
 *   post:
 *     tags: [Admin - Auth & Users]
 *     summary: Get full user details by ID
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User details
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/user/create:
 *   post:
 *     tags: [Admin - Auth & Users]
 *     summary: Create a new user (admin)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminCreateUserInput'
 *     responses:
 *       201:
 *         description: User created
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/user/{id}/change-role:
 *   post:
 *     tags: [Admin - Auth & Users]
 *     summary: Change user role
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminChangeRoleInput'
 *     responses:
 *       200:
 *         description: Role updated
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/user/delete/{id}:
 *   post:
 *     tags: [Admin - Auth & Users]
 *     summary: Delete a user
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/user/verify-password:
 *   post:
 *     tags: [Admin - Auth & Users]
 *     summary: Verify current admin password
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminVerifyPasswordInput'
 *     responses:
 *       200:
 *         description: Password verified
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/user/logout:
 *   post:
 *     tags: [Admin - Auth & Users]
 *     summary: Admin logout
 *     responses:
 *       200:
 *         description: Logged out
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/csrf-token:
 *   get:
 *     tags: [Admin - Auth & Users]
 *     summary: Get CSRF token for admin requests
 *     description: Returns a CSRF token that must be sent as x-csrf-token header on subsequent admin mutations
 *     responses:
 *       200:
 *         description: CSRF token returned
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import {
  login,
  logout,
  refreshAdminToken,
  findAllUser,
  getFullDetails,
  changeRole,
  createUser,
  userDelete,
  verifyPassword,
} from "../../controller/admin/userAdmin.controller.js";
import protect, { adminOnly, csrfProtection } from "../../middleware/authMiddleware.js";
import rateLimit from "../../middleware/rateLimit.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/login", rateLimit.adminLogin, uploadNone, login);
router.post("/refresh", rateLimit.refreshToken, uploadNone, refreshAdminToken);
router.post("/findAllUser", protect, adminOnly, csrfProtection, uploadNone, findAllUser);
router.post("/get-full-details/:id", protect, adminOnly, csrfProtection, uploadNone, getFullDetails);
router.post("/create", protect, adminOnly, csrfProtection, uploadNone, createUser);
router.post("/:id/change-role", protect, adminOnly, csrfProtection, uploadNone, changeRole);
router.post("/delete/:id", protect, adminOnly, csrfProtection, uploadNone, userDelete);
router.post("/verify-password", protect, adminOnly, csrfProtection, uploadNone, verifyPassword);
router.post("/logout", uploadNone, logout);

export default router;
