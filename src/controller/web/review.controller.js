const Reviews = require("../../models/review");
const Product = require("../../models/product");

exports.createReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.user?._id;
    console.log(productId);

    if (!userId) {
      return res.status(401).json({
        _status: false,
        _message: "Please Login TO add review",
        _data: null,
      });
    }

    // Validation
    if (!productId || !rating || !comment) {
      return res.status(400).json({
        _status: false,
        _message: "Product ID, rating, and comment are required",
        _data: null,
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Reviews.findOne({
      userId,
      productId,
    });
    console.log(existingReview);
    if (existingReview) {
      return res.status(400).json({
        _status: false,
        _message: "You have already reviewed this product",
        _data: null,
      });
    }

    // Create new review
    const review = await Reviews.create({
      userId,
      productId,
      rating,
      comment,
    });

    res.status(201).json({
      _status: true,
      _message: "Review submitted successfully",
      _data: review,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: error.message || "Failed to create review",
      _data: null,
    });
  }
};

exports.getReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Reviews.find({
      productId,
      deletedAt: null,
    })
      .populate("userId", "name email avatar")
      .sort("-createdAt")
      .lean();

    const avgRating =
      reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;

    res.status(200).json({
      _status: true,
      _message: "Product Reviews Found",
      _data: reviews,
      _rating: avgRating,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: error.message || "Failed to fetch reviews",
      _data: [],
    });
  }
};
