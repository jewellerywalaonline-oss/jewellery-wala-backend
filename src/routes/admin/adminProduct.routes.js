// src/routes/admin/category.routes.js
const express = require("express");
const router = express.Router();
const {
  create,
  view,
  destroy,
  getOne,
  getByCategory,
  getProductByFilter,
  updateStock,
  update,
  changeStatus,
} = require("../../controller/admin/adminProduct.controller");
const Protect = require("../../middleware/authMiddleware");
const {
  uploadSingle,
  uploadNone,
  uploadProduct,
} = require("../../middleware/uploadMiddleware");
// Category routes
router.post("/create", Protect,  uploadProduct, create);
router.post("/view", Protect, uploadNone, view);
router.post("/details/:id", Protect, getOne);
router.put("/update/:id", Protect,  uploadProduct, update);
router.put("/delete/:id", Protect, uploadNone, destroy);
router.put("/change-status/:id", Protect, uploadNone, changeStatus);
router.put("/update-stock/:id", Protect, uploadNone, updateStock);
router.post(
  "/get-by-category/:categorySlug/:subCategorySlug/:subSubCategorySlug",
  Protect,
  uploadNone,
  getByCategory
);
router.post("/get-by-filter", Protect, uploadNone, getProductByFilter);

module.exports = router;
