/**
 * @openapi
 * tags:
 *   - name: Admin - Colors
 *     description: Admin color option CRUD
 *
 * /api/admin/color/view:
 *   post:
 *     tags: [Admin - Colors]
 *     summary: Get all colors (paginated)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Color list
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
 * /api/admin/color/details:
 *   post:
 *     tags: [Admin - Colors]
 *     summary: Get color details
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Color details
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
 * /api/admin/color/create:
 *   post:
 *     tags: [Admin - Colors]
 *     summary: Create a new color
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminColorInput'
 *     responses:
 *       201:
 *         description: Color created
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
 * /api/admin/color/update/{id}:
 *   put:
 *     tags: [Admin - Colors]
 *     summary: Update a color
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
 *             $ref: '#/components/schemas/AdminColorInput'
 *     responses:
 *       200:
 *         description: Color updated
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
 * /api/admin/color/destroy:
 *   put:
 *     tags: [Admin - Colors]
 *     summary: Delete a color
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Color deleted
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
 * /api/admin/color/change-status:
 *   post:
 *     tags: [Admin - Colors]
 *     summary: Change color status
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminStatusInput'
 *     responses:
 *       200:
 *         description: Status changed
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
 */

import { Router } from "express";
import {
  create,
  update,
  details,
  destroy,
  view,
  changeStatus,
  restore,
} from "../../controller/admin/color.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/create", protect, adminOnly, uploadNone, create);
router.post("/view", protect, adminOnly, uploadNone, view);
router.put("/destroy", protect, adminOnly, uploadNone, destroy);
router.post("/details", protect, adminOnly, uploadNone, details);
router.put("/update/:id", protect, adminOnly, uploadNone, update);
router.post("/change-status", protect, adminOnly, uploadNone, changeStatus);
router.put("/restore", protect, adminOnly, uploadNone, restore);

export default router;
