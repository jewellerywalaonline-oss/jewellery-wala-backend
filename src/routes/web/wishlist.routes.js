const express = require("express");
const router = express.Router();
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkInWishlist,
} = require("../../controller/web/wishlist.controller");
const { uploadNone } = require("../../middleware/uploadMiddleware");
const protect = require("../../middleware/authMiddleware");

router.post("/view", protect, getWishlist);


router.post("/add", protect, uploadNone, addToWishlist);

router.put("/remove/:productId", protect, removeFromWishlist);

router.post("/check/:productId", protect, checkInWishlist);

module.exports = router;
