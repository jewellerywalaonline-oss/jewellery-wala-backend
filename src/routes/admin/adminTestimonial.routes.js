// src/routes/admin/category.routes.js
const express = require("express");
const router = express.Router();
const {
  create,
  view,
  destroy,
  details,
  update,
  changeStatus,
} = require("../../controller/admin/adminTestimonial.controller");
const Protect = require("../../middleware/authMiddleware");
const {
  uploadSingle,
  uploadNone,
} = require("../../middleware/uploadMiddleware");
// Category routes
router.post("/view", Protect, uploadNone, view);
router.post("/details/:id", Protect, details);
router.post("/create", Protect, uploadSingle, create);
router.put("/update/:id", Protect, uploadSingle, update);
router.put("/delete/:id", Protect, uploadNone, destroy);
router.put("/change-status/:id", Protect, uploadNone, changeStatus);

module.exports = router;
