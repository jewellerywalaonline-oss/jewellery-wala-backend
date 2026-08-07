/**
 * @openapi
 * tags:
 *   - name: Colors
 *     description: Product color options
 *
 * /api/website/color:
 *   get:
 *     tags: [Colors]
 *     summary: Get all active colors
 *     responses:
 *       200:
 *         description: Color list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Color'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { colorController } from "../../controller/web/color.controller.js";

const router = Router();

router.get("/", colorController);

export default router;
