const express = require("express");
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} = require("../../controller/web/cart.controller");
const { uploadNone } = require("../../middleware/uploadMiddleware");
const protect = require("../../middleware/authMiddleware");

router.post("/view", protect, getCart);

router.post("/add", protect, uploadNone, addToCart);

router.put("/items/update/:itemId", protect, uploadNone, updateCartItem);

router.put("/items/remove/:itemId", protect, removeFromCart);

router.put("/destroy", protect, clearCart);



module.exports = router;
