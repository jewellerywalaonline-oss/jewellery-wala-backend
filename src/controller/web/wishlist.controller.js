const Wishlist = require("../../models/wishlist");
const Product = require("../../models/product");
const mongoose = require("mongoose");

// Get user's wishlist
module.exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id })
      .populate("products", "name price discount_price images slug stock")
      .lean();

    if (!wishlist || wishlist.products.length === 0) {
      return res.status(200).json({
        _status: true,
        _message: "Your wishlist is empty",
        _data: { items: [] },
      });
    }

    // Format the response
    const items = wishlist.products.map((product) => ({
      _id: product._id,
      name: product.name,
      price: product.price,
      discount_price: product.discount_price,
      image: product.images[0] || null,
      slug: product.slug,
    }));

    res.status(200).json({
      _status: true,
      _message: "Wishlist retrieved successfully",
      _data: items,
    });
  } catch (error) {
    console.error("Error in getWishlist:", error);
    res.status(500).json({
      _status: false,
      _message: "Internal server error while fetching wishlist",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

// Add item to wishlist
module.exports.addToWishlist = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!productId) {
      await session.abortTransaction();
      return res.status(400).json({
        _status: false,
        _message: "Product ID is required",
        _data: null,
      });
    }

    // Verify product exists and is active
    const product = await Product.findOne({
      _id: productId,
      status: true,
      deletedAt: null,
    }).session(session);

    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        _status: false,
        _message: "Product not found or not available",
        _data: null,
      });
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ user: userId }).session(session);

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        products: [],
      });
    }

    // Check if product already exists in wishlist
    if (wishlist.products.some((p) => p.toString() === productId)) {
      await session.abortTransaction();
      return res.status(400).json({
        _status: false,
        _message: "Product already in wishlist",
        _data: null,
      });
    }

    // Add product to wishlist
    wishlist.products.push(productId);
    await wishlist.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      _status: true,
      _message: "Product added to wishlist successfully",
      _data: {
        wishlistId: wishlist._id,
        totalItems: wishlist.products.length,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in addToWishlist:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        _status: false,
        _message: error.message,
        _data: null,
      });
    }

    res.status(500).json({
      _status: false,
      _message: "Failed to add product to wishlist",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  } finally {
    session.endSession();
  }
};

// Remove item from wishlist
module.exports.removeFromWishlist = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId } = req.params;
    const userId = req.user._id;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      await session.abortTransaction();
      return res.status(400).json({
        _status: false,
        _message: "Invalid product ID",
        _data: null,
      });
    }

    // Find wishlist and remove item
    const wishlist = await Wishlist.findOne({ user: userId }).session(session);

    if (!wishlist) {
      await session.abortTransaction();
      return res.status(404).json({
        _status: false,
        _message: "Wishlist not found",
        _data: null,
      });
    }

    const initialCount = wishlist.products.length;
    wishlist.products = wishlist.products.filter(
      (p) => p.toString() !== productId
    );

    if (wishlist.products.length === initialCount) {
      await session.abortTransaction();
      return res.status(404).json({
        _status: false,
        _message: "Product not found in wishlist",
        _data: null,
      });
    }

    await wishlist.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      _status: true,
      _message: "Product removed from wishlist",
      _data: {
        productId,
        remainingItems: wishlist.products.length,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in removeFromWishlist:", error);

    res.status(500).json({
      _status: false,
      _message: "Failed to remove product from wishlist",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  } finally {
    session.endSession();
  }
};

// Check if product is in wishlist
module.exports.checkInWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        _status: false,
        _message: "Invalid product ID",
        _data: null,
      });
    }

    const wishlist = await Wishlist.findOne({
      user: userId,
      products: productId,
    });

    res.status(200).json({
      _status: true,
      _message: "Wishlist status retrieved",
      _data: {
        isInWishlist: !!wishlist,
      },
    });
  } catch (error) {
    console.error("Error in checkInWishlist:", error);

    res.status(500).json({
      _status: false,
      _message: "Failed to check wishlist status",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};
