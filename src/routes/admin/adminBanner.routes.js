const express = require("express");
const router = express.Router();
const {
  createBanner,
    updateBanner,
  deleteBanner,
  getAllBanner,
  changeStatus,
} = require("../../controller/admin/adminBanner.controller");
const protect = require("../../middleware/authMiddleware");
const { uploadSingle } = require("../../middleware/uploadMiddleware");

// create banner
router.post("/create", protect, uploadSingle, createBanner);
// update banner
router.put("/update/:id", protect, uploadSingle, updateBanner);
// delete banner
router.put("/delete/:id", protect, uploadSingle, deleteBanner);
// get all banner
router.post("/view", protect, uploadSingle, getAllBanner);
// change status
router.post("/change-status", protect, uploadSingle, changeStatus);
module.exports = router;
