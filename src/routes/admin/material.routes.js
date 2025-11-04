const express = require("express");
const {
  create,
  update,
  details,
  destroy,
  view,
  changeStatus,
} = require("../../controller/admin/material.controller");
const router = express.Router();
const  protect    = require("../../middleware/authMiddleware");
const { uploadNone } = require("../../middleware/uploadMiddleware");

  router.post("/create", protect,uploadNone, create);
  router.post("/view", protect,uploadNone, view);
  router.put("/destroy", protect,uploadNone, destroy);
  router.post("/details", protect,uploadNone, details);
  router.put("/update/:id", protect,uploadNone, update);
  router.post("/change-status", protect,uploadNone, changeStatus);


module.exports = router;
