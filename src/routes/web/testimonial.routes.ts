/**
 * @openapi
 * tags:
 *   - name: Testimonials
 *     description: Customer testimonials and reviews
 *
 * /api/website/testimonial:
 *   get:
 *     tags: [Testimonials]
 *     summary: Get all active testimonials
 *     responses:
 *       200:
 *         description: Testimonial list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Testimonial'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { testimonialController } from "../../controller/web/testimonial.controller.js";

const router = Router();

router.get("/", testimonialController);

export default router;
