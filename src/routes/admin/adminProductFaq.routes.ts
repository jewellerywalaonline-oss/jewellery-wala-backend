/**
 * @openapi
 * tags:
 *   - name: Admin - Product FAQs
 *     description: Admin product FAQ CRUD operations
 *
 * /api/admin/product-faq/view:
 *   post:
 *     tags: [Admin - Product FAQs]
 *     summary: Get all product FAQs
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Product FAQ list
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
 * /api/admin/product-faq/details:
 *   post:
 *     tags: [Admin - Product FAQs]
 *     summary: Get product FAQ details
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Product FAQ details
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
 * /api/admin/product-faq/create:
 *   post:
 *     tags: [Admin - Product FAQs]
 *     summary: Create a new product FAQ
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminProductFaqInput'
 *     responses:
 *       201:
 *         description: Product FAQ created
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
 /api/admin/product-faq/update/{id}:
 *   put:
 *     tags: [Admin - Product FAQs]
 *     summary: Update a product FAQ
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
 *             $ref: '#/components/schemas/AdminProductFaqInput'
 *     responses:
 *       200:
 *         description: Product FAQ updated
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
 * /api/admin/product-faq/delete/{id}:
 *   put:
 *     tags: [Admin - Product FAQs]
 *     summary: Delete a product FAQ
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
 *         description: Product FAQ deleted
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
 * /api/admin/product-faq/change-status:
 *   post:
 *     tags: [Admin - Product FAQs]
 *     summary: Change product FAQ status
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
  view,
  details,
  update,
  destroy,
  changeStatus,
  restore,
} from "../../controller/admin/adminProductFaq.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";

const router = Router();

router.post("/create", protect, adminOnly, create);
router.post("/view", protect, adminOnly, view);
router.post("/details", protect, adminOnly, details);
router.put("/update/:id", protect, adminOnly, update);
router.put("/delete/:id", protect, adminOnly, destroy);
router.post("/change-status", protect, adminOnly, changeStatus);
router.put("/restore/:id", protect, adminOnly, restore);

export default router;
