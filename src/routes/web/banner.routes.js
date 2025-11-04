const express = require("express");
const router = express.Router();
const { bannerController } = require("../../controller/web/banner.controller");
router.get("/", bannerController);
module.exports = router;
