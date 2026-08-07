/**
 * @openapi
 * tags:
 *   - name: Admin - Dashboard
 *     description: Admin dashboard statistics and activity
 *
 * /api/admin/dashboard/get-dashboard-stats:
 *   post:
 *     tags: [Admin - Dashboard]
 *     summary: Get dashboard statistics
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminDashboardStats'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Admin access required
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
 * /api/admin/dashboard/get-recent-activity:
 *   post:
 *     tags: [Admin - Dashboard]
 *     summary: Get recent admin activity
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Recent activity
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminRecentActivity'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Admin access required
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
 */

import { Router } from "express";
import {
  getDashboardStats,
  getRecentActivity,
} from "../../controller/admin/dashboard.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";

const router = Router();

router.post("/get-dashboard-stats", protect, adminOnly, getDashboardStats);
router.post("/get-recent-activity", protect, adminOnly, getRecentActivity);

export default router;
