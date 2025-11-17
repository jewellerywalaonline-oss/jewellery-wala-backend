const User = require("../../models/user");
const Order = require("../../models/order");
const Product = require("../../models/product");

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get current date and calculate date from one week ago
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for better performance
    const [
      totalProducts,
      totalUsers,
      totalOrders,
      totalRevenueResult,
      lastWeekUsers,
      lastWeekOrders,
      lastWeekRevenue,
    ] = await Promise.all([
      // Total products count
      Product.countDocuments({ deletedAt: null }),

      // Total users count
      User.countDocuments({ isDeleted: { $ne: true } }),

      // Total orders count
      Order.countDocuments({ isDeleted: { $ne: true } }),

      // Total revenue (sum of all order totals)
      Order.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            status: { $nin: ["cancelled", "returned"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$pricing.total" } } },
      ]),

      // Last week new users count
      User.countDocuments({
        createdAt: { $gte: oneWeekAgo },
        isDeleted: { $ne: true },
      }),

      // Last week orders count and revenue
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: oneWeekAgo },
            status: { $nin: ["cancelled", "returned"] },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: "$pricing.total" },
          },
        },
      ]),
    ]);

    // Extract revenue from aggregation results
    const totalRevenue = totalRevenueResult[0]?.total || 0;
    const lastWeekOrdersData = lastWeekOrders[0] || { count: 0, revenue: 0 };

    // Prepare response
    const stats = {
      totals: {
        products: totalProducts,
        users: totalUsers,
        orders: totalOrders,
        revenue: totalRevenue,
      },
      lastWeek: {
        newUsers: lastWeekUsers,
        newOrders: lastWeekOrdersData.count,
        revenue: lastWeekOrdersData.revenue,
        startDate: oneWeekAgo,
        endDate: now,
      },
    };

    res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error in getDashboardStats:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving dashboard statistics",
      error: error.message,
    });
  }
};

// Get recent activity for dashboard
exports.getRecentActivity = async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Get recent orders with user details
    const recentOrders = await Order.find({
      createdAt: { $gte: oneWeekAgo },
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email avatar")
      .select("orderId pricing.total pricing.status createdAt");

    // Get recent users
    const recentUsers = await User.find({
      createdAt: { $gte: oneWeekAgo },
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name email createdAt avatar");

    res.status(200).json({
      success: true,
      message: "Recent activity retrieved successfully",
      data: {
        recentOrders,
        recentUsers,
      },
    });
  } catch (error) {
    console.error("Error in getRecentActivity:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving recent activity",
      error: error.message,
    });
  }
};



// Export both functions as methods of the dashboard object
const dashboard = {
  getDashboardStats: exports.getDashboardStats,
  getRecentActivity: exports.getRecentActivity,
};

module.exports = dashboard;
