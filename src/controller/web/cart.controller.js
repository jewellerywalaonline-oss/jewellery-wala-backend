const Cart = require("../../models/cart");
const Product = require("../../models/product");
const mongoose = require("mongoose");

// Get user's cart
module.exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate("items.product")
      .populate("items.color")
      .populate("items.size")
      .lean();
    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        _status: true,
        _message: "Your cart is empty",
        _data: { items: [], totalItems: 0, totalPrice: 0 },
      });
    }
    // Calculate total items and price
    let totalItems = 0;
    let totalPrice = 0;

    const items = await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.findById(item.product)
          .select("name price discount_price images slug stock")
          .lean();
        const itemTotal =
          product.discount_price > 0
            ? product.discount_price * item.quantity
            : product.price * item.quantity;

        totalItems += item.quantity;
        totalPrice += itemTotal;

        return {
          _id: item._id,
          product: {
            _id: product._id,
            name: product.name,
            price: product.price,
            discount_price: product.discount_price,
            image: product.images[0] || null,
            slug: product.slug,
            stock: product.stock,
          },
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          itemTotal: itemTotal,
        };
      })
    );
    res.status(200).json({
      _status: true,
      _message: "Cart retrieved successfully",
      _data: {
        items: items,
        totalItems,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error in getCart:", error);
    res.status(500).json({
      _status: false,
      _message: "Internal server error while fetching cart",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

// Add item to cart
module.exports.addToCart = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity = 1, colorId, sizeId } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!productId || !colorId) {
      await session.abortTransaction();
      return res.status(400).json({
        _status: false,
        _message: "Product ID and Color ID are required",
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

    // Check stock availability
    if (product.stock < quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        _status: false,
        _message: "Insufficient stock",
        _data: { availableStock: product.stock },
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: userId }).session(session);

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
      });
    }

    // Check if product with same color and size already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        item.color.toString() === colorId &&
        (item.size?.toString() || null) === (sizeId || null)
    );

    if (existingItemIndex > -1) {
      // Update quantity if item exists
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        color: colorId,
        size: sizeId || null,
      });
    }

    await cart.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      _status: true,
      _message:
        existingItemIndex > -1
          ? "Quantity Increased in cart"
          : "Product added to cart",
      _data: {
        cartId: cart._id,
        totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in addToCart:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        _status: false,
        _message: error.message,
        _data: null,
      });
    }

    res.status(500).json({
      _status: false,
      _message: "Failed to add product to cart",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  } finally {
    session.endSession();
  }
};

// Update cart item quantity
module.exports.updateCartItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      await session.abortTransaction();
      return res.status(400).json({
        _status: false,
        _message: "Invalid item ID",
        _data: null,
      });
    }

    if (!quantity || quantity < 1) {
      await session.abortTransaction();
      return res.status(400).json({
        _status: false,
        _message: "Quantity must be at least 1",
        _data: null,
      });
    }

    // Find cart and item
    const cart = await Cart.findOne({ user: userId }).session(session);

    if (!cart) {
      await session.abortTransaction();
      return res.status(404).json({
        _status: false,
        _message: "Cart not found",
        _data: null,
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({
        _status: false,
        _message: "Item not found in cart",
        _data: null,
      });
    }

    // Verify stock before updating
    const product = await Product.findById(
      cart.items[itemIndex].product
    ).session(session);

    if (!product || product.stock < quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        _status: false,
        _message: "Insufficient stock",
        _data: {
          availableStock: product?.stock || 0,
          currentQuantity: cart.items[itemIndex].quantity,
        },
      });
    } else if (cart.items[itemIndex].quantity > quantity) {
      cart.items[itemIndex].quantity = quantity;
      await cart.save({ session });
      await session.commitTransaction();
      return res.status(200).json({
        _status: true,
        _message: "Cart updated successfully",
        _data: {
          itemId,
          newQuantity: quantity,
        },
      });
    }

    // Update quantity
    cart.items[itemIndex].quantity = quantity;
    await cart.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      _status: true,
      _message: "Cart updated successfully",
      _data: {
        itemId,
        newQuantity: quantity,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in updateCartItem:", error);

    res.status(500).json({
      _status: false,
      _message: "Failed to update cart",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  } finally {
    session.endSession();
  }
};

// Remove item from cart
module.exports.removeFromCart = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { itemId } = req.params;
    const userId = req.user._id;

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      await session.abortTransaction();
      return res.status(400).json({
        _status: false,
        _message: "Invalid item ID",
        _data: null,
      });
    }

    // Find cart and remove item
    const cart = await Cart.findOne({ user: userId }).session(session);

    if (!cart) {
      await session.abortTransaction();
      return res.status(404).json({
        _status: false,
        _message: "Cart not found",
        _data: null,
      });
    }

    const initialCount = cart.items.length;
    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);

    if (cart.items.length === initialCount) {
      await session.abortTransaction();
      return res.status(404).json({
        _status: false,
        _message: "Item not found in cart",
        _data: null,
      });
    }

    await cart.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      _status: true,
      _message: "Item removed from cart",
      _data: {
        itemId,
        remainingItems: cart.items.length,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in removeFromCart:", error);

    res.status(500).json({
      _status: false,
      _message: "Failed to remove item from cart",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  } finally {
    session.endSession();
  }
};

// Clear cart
module.exports.clearCart = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;

    const result = await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } },
      { new: true, session }
    );

    if (!result) {
      await session.abortTransaction();
      return res.status(404).json({
        _status: false,
        _message: "Cart not found",
        _data: null,
      });
    }

    await session.commitTransaction();

    res.status(200).json({
      _status: true,
      _message: "Cart cleared successfully",
      _data: null,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in clearCart:", error);

    res.status(500).json({
      _status: false,
      _message: "Failed to clear cart",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  } finally {
    session.endSession();
  }
};

// cart count
