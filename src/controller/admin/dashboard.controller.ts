import type { Request, Response } from "express";
import User from "../../models/user.js";
import Order from "../../models/order.js";
import Product from "../../models/product.js";
import { logger } from "../../lib/logger.js";

interface MonthlyRevenue {
  _id: { year: number; month: number };
  revenue: number;
  orders: number;
}

interface OrderStatusCount {
  _id: string;
  count: number;
}

interface CategorySalesCount {
  _id: string;
  name: string;
  sales: number;
}

interface UserGrowthItem {
  _id: { year: number; month: number };
  count: number;
}

export const getDashboardStats = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const [
      totalProducts,
      totalUsers,
      totalOrders,
      totalRevenueResult,
      lastWeekUsers,
      lastWeekOrders,
      monthlyRevenue,
      orderStatusCounts,
      categorySales,
      userGrowth,
    ] = await Promise.all([
      Product.countDocuments({ deletedAt: null }),
      User.countDocuments({ isDeleted: { $ne: true } }),
      Order.countDocuments({ isDeleted: { $ne: true } }),
      Order.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            status: { $nin: ["cancelled", "returned"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$pricing.total" } } },
      ]),
      User.countDocuments({
        createdAt: { $gte: oneWeekAgo },
        isDeleted: { $ne: true },
      }),
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
      // Monthly revenue trend (last 6 months)
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: sixMonthsAgo },
            isDeleted: { $ne: true },
            status: { $nin: ["cancelled", "returned"] },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            revenue: { $sum: "$pricing.total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      // Order status distribution
      Order.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      // Top categories by product sales
      Order.aggregate([
        { $unwind: "$items" },
        {
          $match: {
            isDeleted: { $ne: true },
            status: { $nin: ["cancelled", "returned"] },
          },
        },
        {
          $group: {
            _id: "$items.name",
            sales: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.subtotal" },
          },
        },
        { $sort: { sales: -1 } },
        { $limit: 10 },
      ]),
      // User growth (last 6 months)
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: sixMonthsAgo },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    const totalRevenue = (totalRevenueResult[0] as { total?: number } | undefined)?.total ?? 0;
    const lastWeekOrdersData = (lastWeekOrders[0] as { count?: number; revenue?: number } | undefined) ?? {
      count: 0,
      revenue: 0,
    };

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
      charts: {
        revenueTrend: (monthlyRevenue as MonthlyRevenue[]).map((m) => ({
          month: monthNames[m._id.month - 1],
          revenue: m.revenue,
          orders: m.orders,
        })),
        orderStatus: (orderStatusCounts as OrderStatusCount[]).map((s) => ({
          status: s._id,
          value: s.count,
        })),
        topCategories: (categorySales as CategorySalesCount[]).map((c) => ({
          name: c.name,
          sales: c.sales,
        })),
        userGrowth: (userGrowth as UserGrowthItem[]).map((m) => ({
          month: monthNames[m._id.month - 1],
          users: m.count,
        })),
      },
    };

    res.status(200).json({
      _status: true,
      _message: "Dashboard statistics retrieved successfully",
      _data: stats,
    });
  } catch (error) {
    logger.error({ err: error }, "Error in getDashboardStats");
    res.status(500).json({
      _status: false,
      _message: "Error retrieving dashboard statistics",
      _error: "Internal Server Error",
    });
  }
};

export const getRecentActivity = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentOrders = await Order.find({
      createdAt: { $gte: oneWeekAgo },
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email avatar")
      .select("orderId pricing.total pricing.status createdAt")
      .lean();

    const recentUsers = await User.find({
      createdAt: { $gte: oneWeekAgo },
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name email createdAt avatar")
      .lean();

    res.status(200).json({
      _status: true,
      _message: "Recent activity retrieved successfully",
      _data: {
        recentOrders,
        recentUsers,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error in getRecentActivity");
    res.status(500).json({
      _status: false,
      _message: "Error retrieving recent activity",
      _error: "Internal Server Error",
    });
  }
};

const dashboard = {
  getDashboardStats,
  getRecentActivity,
};

export default dashboard;