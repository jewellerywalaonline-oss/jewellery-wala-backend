const express = require("express");
const router = express.Router();
const {
  login,
  findAllUser,
  getFullDetails,
  changeRole,
  delieveryLogin,
} = require("../../controller/admin/userAdmin.controller");
const protect = require("../../middleware/authMiddleware");
const { uploadNone } = require("../../middleware/uploadMiddleware");
router.post("/login", uploadNone, login);
router.post("/findAllUser", protect, uploadNone, findAllUser);
router.post("/get-full-details/:id", protect, uploadNone, getFullDetails);
router.post("/:id/change-role", protect, uploadNone, changeRole);
router.post("/delievery-login", uploadNone, delieveryLogin);

module.exports = router;
