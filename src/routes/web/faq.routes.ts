/**
 * @openapi
 * tags:
 *   - name: FAQs
 *     description: Frequently asked questions
 *
 * /api/website/faq:
 *   get:
 *     tags: [FAQs]
 *     summary: Get all active FAQs
 *     responses:
 *       200:
 *         description: FAQ list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FAQ'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { faqController } from "../../controller/web/faq.controller.js";

const router = Router();

router.get("/", faqController);

export default router;
