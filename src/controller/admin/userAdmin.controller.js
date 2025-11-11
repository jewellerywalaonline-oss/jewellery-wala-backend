// admin panel login and user management
const { generateToken } = require("../../lib/jwt");
const userModel = require("../../models/user");
const Cart = require("../../models/cart");
const Order = require("../../models/order");
const Wishlist = require("../../models/wishlist");
const Reviews = require("../../models/review");

// admin panel login
exports.login = async (req, res) => {
  if (!req.body) {
    return res
      .status(400)
      .json({ _status: false, _message: "No data provided" });
  }
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        _status: false,
        _message: "All fields are required",
      });
    }
    const user = await userModel.findOne({ email, role: "admin" });
    if (!user) {
      return res.status(404).json({
        _status: false,
        _message: "Admin not found",
      });
    }
    const token = generateToken(user);
    return res.status(200).json({
      _status: true,
      _message: "Admin logged in successfully",
      _token: token,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && {
        _error: error.message,
      }),
    });
  }
};

exports.findAllUser = async (req, res) => {
  try {
    const users = await userModel.find({ deletedAt: null }).lean();
    return res.status(200).json({
      _status: true,
      _message: "Users found successfully",
      _data: users,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && {
        _error: error.message,
      }),
    });
  }
};
exports.getFullDetails = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);
    const cart = await Cart.find({ user: req.params.id })
      .populate("items.product", "name images image discount_price price slug")
      .populate("items.color");
    const orders = await Order.find({ userId: req.params.id })
      .populate("items.productId", "name images slug")
      .select("-payment.razorpay.signature");
    const wishlist = await Wishlist.find({ user: req.params.id }).populate(
      "products",
      "name price discount_price images slug stock"
    );
    const reviews = await Reviews.find({ userId: req.params.id }).populate(
      "productId",
      "name images slug"
    );
    return res.status(200).json({
      _status: true,
      _message: "User found successfully",
      _user: user,
      _cart: cart,
      _orders: orders,
      _wishlist: wishlist,
      _reviews: reviews,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && {
        _error: error.message,
      }),
      _error: error.message,
    });
  }
};

exports.delieveryLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        _status: false,
        _message: "All fields are required",
      });
    }
    const user = await userModel.findOne({ email, role: "delivery" });
    if (!user) {
      return res.status(404).json({
        _status: false,
        _message: "Delivery Account not found",
      });
    }
    const token = generateToken(user);
    return res.status(200).json({
      _status: true,
      _message: "Delivery logged in successfully",
      _token: token,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && {
        _error: error.message,
      }),
    });
  }
};

// user role change
exports.changeRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.body.role;

    // Find the user and update their role
    const user = await userModel.findByIdAndUpdate(
      id,
      { role: role },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        _status: false,
        _message: "User not found",
      });
    }

    res.status(200).json({
      _status: true,
      _message: "User role updated to delivery successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in changeRole:", error);
    res.status(500).json({
      _status: false,
      _message: "Error updating user role",
      error: error.message,
    });
  }
};

exports.userDelete = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        _status: false,
        _message: "User not found",
      });
    }
    user.deletedAt = new Date();
    await user.save();
    return res.status(200).json({
      _status: true,
      _message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error in userDelete:", error);
    res.status(500).json({
      _status: false,
      _message: "Error deleting user",
      error: error.message,
    });
  }
};
