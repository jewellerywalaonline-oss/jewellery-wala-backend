const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity,
} = require("../../controller/admin/dashboard.controller");
const protect = require("../../middleware/authMiddleware");

router.post("/get-dashboard-stats", protect, getDashboardStats);
router.post("/get-recent-activity", protect, getRecentActivity);

module.exports = router;