/**
 * @openapi
 * tags:
 *   - name: Admin - Testimonials
 *     description: Admin testimonial CRUD operations
 *
 * /api/admin/testimonial/view:
 *   post:
 *     tags: [Admin - Testimonials]
 *     summary: Get all testimonials (paginated)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Testimonial list
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
 * /api/admin/testimonial/details/{id}:
 *   post:
 *     tags: [Admin - Testimonials]
 *     summary: Get testimonial by ID
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
 *         description: Testimonial details
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
 * /api/admin/testimonial/create:
 *   post:
 *     tags: [Admin - Testimonials]
 *     summary: Create a new testimonial
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AdminTestimonialInput'
 *     responses:
 *       201:
 *         description: Testimonial created
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
 * /api/admin/testimonial/update/{id}:
 *   put:
 *     tags: [Admin - Testimonials]
 *     summary: Update a testimonial
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
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AdminTestimonialInput'
 *     responses:
 *       200:
 *         description: Testimonial updated
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
 * /api/admin/testimonial/delete/{id}:
 *   put:
 *     tags: [Admin - Testimonials]
 *     summary: Soft-delete a testimonial
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
 *         description: Testimonial deleted
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
 * /api/admin/testimonial/change-status/{id}:
 *   put:
 *     tags: [Admin - Testimonials]
 *     summary: Change testimonial status
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
  destroy,
  details,
  update,
  changeStatus,
  restore,
} from "../../controller/admin/adminTestimonial.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import {
  uploadSingle,
  uploadNone,
} from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/view", protect, adminOnly, uploadNone, view);
router.post("/details/:id", protect, adminOnly, details);
router.post("/create", protect, adminOnly, uploadSingle, create);
router.put("/update/:id", protect, adminOnly, uploadSingle, update);
router.put("/delete/:id", protect, adminOnly, uploadNone, destroy);
router.put("/change-status/:id", protect, adminOnly, uploadNone, changeStatus);
router.put("/restore/:id", protect, adminOnly, uploadNone, restore);

export default router;
