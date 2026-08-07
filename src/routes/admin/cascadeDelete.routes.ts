import { Router } from "express";
import { preview, execute } from "../../controller/admin/cascadeDelete.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/cascade-delete-preview", protect, adminOnly, uploadNone, preview);
router.post("/cascade-delete-execute", protect, adminOnly, uploadNone, execute);

export default router;
