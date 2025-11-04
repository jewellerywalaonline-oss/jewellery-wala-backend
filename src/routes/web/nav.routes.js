const express = require("express");
const router = express.Router();
const { navController} = require("../../controller/web/nav.controller");
const { uploadNone } = require("../../middleware/uploadMiddleware");

router.post("/", uploadNone, navController);

module.exports = router;