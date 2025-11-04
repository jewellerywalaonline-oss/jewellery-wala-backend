const express = require("express");
const router = express.Router();
const { faqController } = require("../../controller/web/faq.controller");
router.get("/", faqController);
module.exports = router;
