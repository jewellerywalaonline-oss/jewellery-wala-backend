/**
 * @openapi
 * tags:
 *   - name: Coupons
 *     description: Coupon code validation
 *
 * /api/website/coupen/single/{id}:
 *   get:
 *     tags: [Coupons]
 *     summary: Get coupon by ID
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
 *         description: Coupon data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   $ref: '#/components/schemas/Coupon'
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
 * /api/website/coupen/find:
 *   get:
 *     tags: [Coupons]
 *     summary: Find coupon by code
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon found
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
 */

import { Router } from "express";
import { coupenPopUp, findCoupen } from "../../controller/web/coupen.controller.js";
import protect from "../../middleware/authMiddleware.js";

const router = Router();

router.get("/single/:id", protect, coupenPopUp);

router.get("/find", protect, findCoupen);

export default router;
