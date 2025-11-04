const express = require("express");
const router = express.Router();
const { createReview, getReviewsByProduct } = require("../../controller/web/review.controller");
const { uploadNone } = require("../../middleware/uploadMiddleware");
const  protect  = require("../../middleware/authMiddleware");

router.post("/create", uploadNone,protect, createReview);
router.post("/get/:productId", uploadNone, getReviewsByProduct);

module.exports = router;