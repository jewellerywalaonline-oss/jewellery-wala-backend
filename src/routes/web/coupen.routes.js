const express = require("express");
const router = express.Router();
const {
  coupenPopUp,
  findCoupen,
} = require("../../controller/web/coupen.controller");
const protect = require("../../middleware/authMiddleware");

router.get("/single/:id", protect, coupenPopUp);

router.get("/find", protect, findCoupen);

module.exports = router;
