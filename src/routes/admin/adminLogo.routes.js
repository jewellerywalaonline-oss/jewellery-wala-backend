const express = require("express");
const {
  create,
  update,
  destroy,
  view,
  changeStatus,
} = require("../../controller/admin/adminLogo.controller");
const router = express.Router();
const protect = require("../../middleware/authMiddleware");
const { uploadLogo, uploadNone } = require("../../middleware/uploadMiddleware");

router.post("/create", protect, uploadLogo, create);
router.post("/view", protect, uploadNone, view);
router.put("/destroy/:id", protect, uploadNone, destroy);
router.put("/update/:id", protect, uploadLogo, update);
router.post("/change-status", protect, uploadNone, changeStatus);

module.exports = router;
