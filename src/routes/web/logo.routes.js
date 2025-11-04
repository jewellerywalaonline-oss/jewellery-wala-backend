const express = require("express");
const router = express.Router();
const { logoController } = require("../../controller/web/logo.controller");
router.post("/", logoController);
module.exports = router;
