const express = require("express");
const router = express.Router();
const { testimonialController } = require("../../controller/web/testimonial.controller");
router.get("/", testimonialController);
module.exports = router;
