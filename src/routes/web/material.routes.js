const express = require("express");
const router = express.Router();
const { materialController } = require("../../controller/web/material.controller");
router.get("/", materialController);
module.exports = router;
