/**
 * @openapi
 * tags:
 *   - name: Materials
 *     description: Product material options
 *
 * /api/website/material:
 *   get:
 *     tags: [Materials]
 *     summary: Get all active materials
 *     responses:
 *       200:
 *         description: Material list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Material'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { materialController } from "../../controller/web/material.controller.js";

const router = Router();

router.get("/", materialController);

export default router;
