const express = require("express");
const router = express.Router();
const { colorController } = require("../../controller/web/color.controller");
router.post("/", colorController);
module.exports = router;
