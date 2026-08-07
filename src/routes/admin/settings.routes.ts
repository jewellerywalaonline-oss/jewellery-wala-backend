import { Router } from "express";
import {
  getSettings,
  updateSettings,
} from "../../controller/admin/settings.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";

const router = Router();

router.get("/", protect, adminOnly, getSettings);
router.put("/", protect, adminOnly, updateSettings);

export default router;
