/**
 * @openapi
 * tags:
 *   - name: Admin - Sizes
 *     description: Admin size option CRUD (ring/bangle sizes for jewellery)
 */

import { Router } from "express";
import {
  create,
  update,
  details,
  destroy,
  view,
  changeStatus,
} from "../../controller/admin/size.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/create", protect, adminOnly, uploadNone, create);
router.post("/view", protect, adminOnly, uploadNone, view);
router.put("/destroy", protect, adminOnly, uploadNone, destroy);
router.post("/details", protect, adminOnly, uploadNone, details);
router.put("/update/:id", protect, adminOnly, uploadNone, update);
router.post("/change-status", protect, adminOnly, uploadNone, changeStatus);

export default router;
