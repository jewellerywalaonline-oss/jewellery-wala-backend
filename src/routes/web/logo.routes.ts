/**
 * @openapi
 * tags:
 *   - name: Logo
 *     description: Site logo
 *
 * /api/website/logo:
 *   post:
 *     tags: [Logo]
 *     summary: Get site logo
 *     responses:
 *       200:
 *         description: Logo data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   $ref: '#/components/schemas/Logo'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { logoController } from "../../controller/web/logo.controller.js";

const router = Router();

router.post("/", logoController);

export default router;
