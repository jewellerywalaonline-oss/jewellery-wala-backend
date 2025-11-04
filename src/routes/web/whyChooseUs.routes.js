const express = require("express");
const router = express.Router();
const { whyChooseUsController } = require("../../controller/web/whyChooseUs.controller");
router.get("/", whyChooseUsController);
module.exports = router;
