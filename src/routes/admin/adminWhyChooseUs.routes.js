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
} = require("../../controller/admin/adminWhyChooseUs.controller");
const Protect = require("../../middleware/authMiddleware");
const { uploadNone } = require("../../middleware/uploadMiddleware");
// Category routes
router.post("/view", Protect, uploadNone, view);
router.post("/details/:id", Protect, uploadNone, details);
router.post("/create", Protect, uploadNone, create);
router.put("/update/:id", Protect, uploadNone, update);
router.put("/delete/:id", Protect, uploadNone, destroy);
router.put("/change-status/:id", Protect, uploadNone, changeStatus);

module.exports = router;
