/**
 * @openapi
 * tags:
 *   - name: Why Choose Us
 *     description: Why Choose Us section content
 *
 * /api/website/whyChooseUs:
 *   get:
 *     tags: [Why Choose Us]
 *     summary: Get Why Choose Us content
 *     responses:
 *       200:
 *         description: Why Choose Us data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WhyChooseUs'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { whyChooseUsController } from "../../controller/web/whyChooseUs.controller.js";

const router = Router();

router.get("/", whyChooseUsController);

export default router;
