// src/routes/admin/category.routes.js
const express = require("express");
const router = express.Router();
const {
  getOne,
  getByCategory,
  getProductByFilter,
  getBySearch,
  getAll,
  relatedProducts,
  tabProducts,
  newArrivals,
  trendingProducts,
  featuredForFooter,
} = require("../../controller/web/product.controller");
const { uploadNone } = require("../../middleware/uploadMiddleware");
// Category routes
router.post("/details/:slug", uploadNone, getOne);
router.post(
  "/get-by-category/:categorySlug/:subCategorySlug/:subSubCategorySlug",
  uploadNone,
  getByCategory
);
router.post("/get-by-filter", uploadNone, getProductByFilter);
router.post("/get-by-search", uploadNone, getBySearch);
router.post("/get-related-products", uploadNone, relatedProducts);
// tab products
router.get("/tab-products", uploadNone,  tabProducts);
router.get("/new-arrivals", uploadNone, newArrivals);
router.get("/trending-products", uploadNone, trendingProducts);
router.get("/featured-for-footer", uploadNone, featuredForFooter);

// sitemap products
router.post("/all", uploadNone, getAll);

module.exports = router;
