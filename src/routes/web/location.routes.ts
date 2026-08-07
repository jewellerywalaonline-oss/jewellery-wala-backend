/**
 * @openapi
 * tags:
 *   - name: Location
 *     description: Geolocation helpers for checkout
 *
 * /api/website/location/reverse-geocode:
 *   post:
 *     tags: [Location]
 *     summary: Reverse-geocode lat/lng to a shipping address (India only)
 *     description: |
 *       Proxies the LocationIQ reverse-geocode API (key stays server-side).
 *       Used by the checkout page to auto-fill the shipping address form for guests.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat: { type: number, example: 26.2389, description: "Latitude (-90 to 90)" }
 *               lng: { type: number, example: 73.0243, description: "Longitude (-180 to 180)" }
 *     responses:
 *       200:
 *         description: Mapped shipping address fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean }
 *                 _data:
 *                   type: object
 *                   properties:
 *                     pincode: { type: string, example: "342005" }
 *                     city: { type: string, example: "Jodhpur" }
 *                     state: { type: string, example: "Rajasthan" }
 *                     area: { type: string }
 *                     street: { type: string }
 *                     country: { type: string, example: "India" }
 *                     displayName: { type: string }
 *       400:
 *         description: Invalid coordinates
 *       422:
 *         description: Location outside India or missing postal code
 *       503:
 *         description: Location service not configured
 *       500:
 *         description: Internal server error
 */

import { Router } from "express";
import { reverseGeocode } from "../../controller/web/location.controller.js";
import rateLimiters from "../../middleware/rateLimit.js";

const router = Router();

router.post("/reverse-geocode", rateLimiters.reverseGeocode, reverseGeocode);

export default router;
