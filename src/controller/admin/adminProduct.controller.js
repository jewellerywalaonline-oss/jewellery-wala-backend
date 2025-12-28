const Product = require("../../models/product");
const mongoose = require("mongoose");
const Category = require("../../models/category");
const SubCategory = require("../../models/subCategory");
const SubSubCategory = require("../../models/subSubCategory");
const Size = require("../../models/size");
const { uploadToR2, deleteFromR2 } = require("../../lib/cloudflare");
const { generateUniqueSlug } = require("../../lib/slugFunc");
const cache = require("../../lib/cache");

// Create Product
exports.create = async (request, response) => {
  try {
    const data = new Product(request.body);

    // Upload main image to Cloudflare R2 if file exists
    if (request.files) {
      // Handle main image
      if (request.files.image && request.files.image[0]) {
        const uploadResult = await uploadToR2(
          request.files.image[0],
          "products",
          85
        );
        if (uploadResult.success) {
          data.image = uploadResult.url;
        } else {
          throw new Error("Failed to upload main image");
        }
      }

      // Handle additional images
      if (request.files.images && request.files.images.length > 0) {
        const imageUrls = [];
        for (const file of request.files.images) {
          const uploadResult = await uploadToR2(file, "products");
          if (uploadResult.success) {
            imageUrls.push(uploadResult.url);
          }
        }
        data.images = imageUrls;
      }
    }

    // Generate slug
    const slug = await generateUniqueSlug(Product, data.name);
    data.slug = slug;

    // Validate categories exist (handle both single and multiple)
    if (data.category) {
      const categoryIds = Array.isArray(data.category)
        ? data.category
        : [data.category];

      for (const catId of categoryIds) {
        const categoryExists = await Category.findById(catId);
        if (!categoryExists) {
          throw new Error(`Category with ID ${catId} not found`);
        }
      }
    }

    // Validate subCategories exist (handle both single and multiple)
    if (data.subCategory) {
      const subCategoryIds = Array.isArray(data.subCategory)
        ? data.subCategory
        : [data.subCategory];

      for (const subCatId of subCategoryIds) {
        const subCategoryExists = await SubCategory.findById(subCatId);
        if (!subCategoryExists) {
          throw new Error(`SubCategory with ID ${subCatId} not found`);
        }
      }
    }

    // Validate subSubCategories exist (handle both single and multiple)
    if (data.subSubCategory) {
      const subSubCategoryIds = Array.isArray(data.subSubCategory)
        ? data.subSubCategory
        : [data.subSubCategory];

      for (const subSubCatId of subSubCategoryIds) {
        const subSubCategoryExists = await SubSubCategory.findById(subSubCatId);
        if (!subSubCategoryExists) {
          throw new Error(`SubSubCategory with ID ${subSubCatId} not found`);
        }
      }
    }

    // Validate sizes exist (handle both single and multiple)
    if (data.sizes) {
      const sizeIds = Array.isArray(data.sizes) ? data.sizes : [data.sizes];

      for (const sizeId of sizeIds) {
        const sizeExists = await Size.findById(sizeId);
        if (!sizeExists) {
          throw new Error(`Size with ID ${sizeId} not found`);
        }
      }
    }

    const ress = await data.save();
    cache.del("newArrivals");
    cache.del("trendingProducts");
    cache.del("featuredForFooter");
    cache.del("tabProducts");
    const output = {
      _status: true,
      _message: "Product created successfully",
      _data: ress,
    };

    response.send(output);
  } catch (err) {
    const messages = [];

    if (err.errors) {
      for (let msg in err.errors) {
        if (err.errors[msg].message) {
          messages.push(err.errors[msg].message);
        }
      }
    } else {
      messages.push(err.message || "Something went wrong");
    }

    const output = {
      _status: false,
      _message: messages,
      _data: [],
    };

    response.send(output);
  }
};

// Get All Products
exports.view = async (request, response) => {
  try {
    const {
      categories,
      subCategories,
      subSubCategories,
      minPrice,
      maxPrice,
      search,
      sort = "-createdAt",
      inStock,
    } = request.query;

    const query = { deletedAt: null };

    // Filter by category
    if (categories) {
      query.categories = Array.isArray(categories)
        ? { $in: categories }
        : categories;
    }
    if (subCategories) {
      query.subCategories = Array.isArray(subCategories)
        ? { $in: subCategories }
        : subCategories;
    }
    if (subSubCategories) {
      query.subSubCategories = Array.isArray(subSubCategories)
        ? { $in: subSubCategories }
        : subSubCategories;
    }
    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Filter by stock
    if (inStock === "true") {
      query.stock = { $gt: 0 };
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(query).sort(sort);

    const output = {
      _status: true,
      _message: "Products fetched successfully",
      _data: products,
    };

    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: err.message || "Something went wrong",
      _data: [],
    };

    response.send(output);
  }
};

// Get Single Product by ID or Slug
exports.getOne = async (request, response) => {
  try {
    const { id, slug } = request.params;

    let product;

    // Check if id is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id)
        .populate("colors", "name code")
        .populate("material", "name ")
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .populate("subSubCategory", "name slug")
        .populate("sizes", "name");
    } else {
      // Find by slug
      product = await Product.findOne({ slug: slug })
        .populate("colors", "name code")
        .populate("material", "name ")
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .populate("subSubCategory", "name slug")
        .populate("sizes", "name");
    }

    if (!product) {
      throw new Error("Product not found");
    }

    const output = {
      _status: true,
      _message: "Product fetched successfully",
      _data: product,
    };

    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: err.message || "Something went wrong",
      _data: null,
    };

    response.send(output);
  }
};

// Update Product
exports.update = async (request, response) => {
  try {
    const { id } = request.params;
    const updateData = { ...request.body };
    const removeImagesUrl = request.body.removeImagesUrl || [];
    // Find existing product
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      throw new Error("Product not found");
    }

    // Upload new main image if provided
    if (request.files) {
      // Handle main image
      if (request.files.image && request.files.image[0]) {
        const uploadResult = await uploadToR2(
          request.files.image[0],
          "products"
        );
        if (uploadResult.success) {
          updateData.image = uploadResult.url;
        } else {
          throw new Error("Failed to upload main image");
        }
      }

      // Handle additional images
      if (request.files?.images?.length > 0) {
        updateData.images = existingProduct.images || [];
        if (removeImagesUrl.length > 0) {
          removeImagesUrl.forEach((url) => {
            updateData.images = updateData.images.filter(
              (image) => image !== url
            );
          });
        }

        for (const file of request.files.images) {
          const uploadResult = await uploadToR2(file, "products");
          if (uploadResult?.success && uploadResult?.url) {
            updateData.images.push(uploadResult.url);
          }
        }
      }
    }

    // Update slug if name changed
    if (updateData.name && updateData.name !== existingProduct.name) {
      const slug = await generateUniqueSlug(Product, updateData.name);
      updateData.slug = slug;
    }

    // Validate categories if changed (handle both single and multiple)
    if (updateData.category) {
      const categoryIds = Array.isArray(updateData.category)
        ? updateData.category
        : [updateData.category];

      // Check if categories have changed
      const existingCategoryIds = Array.isArray(existingProduct.category)
        ? existingProduct.category.map((id) => id.toString())
        : [existingProduct.category.toString()];

      const categoriesChanged =
        JSON.stringify(categoryIds.sort()) !==
        JSON.stringify(existingCategoryIds.sort());

      if (categoriesChanged) {
        for (const catId of categoryIds) {
          const categoryExists = await Category.findById(catId);
          if (!categoryExists) {
            throw new Error(`Category with ID ${catId} not found`);
          }
        }
      }
    }

    // Validate subCategories if changed (handle both single and multiple)
    if (updateData.subCategory) {
      const subCategoryIds = Array.isArray(updateData.subCategory)
        ? updateData.subCategory
        : [updateData.subCategory];

      // Check if subCategories have changed
      const existingSubCategoryIds = existingProduct.subCategory
        ? Array.isArray(existingProduct.subCategory)
          ? existingProduct.subCategory.map((id) => id.toString())
          : [existingProduct.subCategory.toString()]
        : [];

      const subCategoriesChanged =
        JSON.stringify(subCategoryIds.sort()) !==
        JSON.stringify(existingSubCategoryIds.sort());

      if (subCategoriesChanged) {
        for (const subCatId of subCategoryIds) {
          const subCategoryExists = await SubCategory.findById(subCatId);
          if (!subCategoryExists) {
            throw new Error(`SubCategory with ID ${subCatId} not found`);
          }
        }
      }
    }

    // Validate subSubCategories if changed (handle both single and multiple)
    if (updateData.subSubCategory) {
      const subSubCategoryIds = Array.isArray(updateData.subSubCategory)
        ? updateData.subSubCategory
        : [updateData.subSubCategory];

      // Check if subSubCategories have changed
      const existingSubSubCategoryIds = existingProduct.subSubCategory
        ? Array.isArray(existingProduct.subSubCategory)
          ? existingProduct.subSubCategory.map((id) => id.toString())
          : [existingProduct.subSubCategory.toString()]
        : [];

      const subSubCategoriesChanged =
        JSON.stringify(subSubCategoryIds.sort()) !==
        JSON.stringify(existingSubSubCategoryIds.sort());

      if (subSubCategoriesChanged) {
        for (const subSubCatId of subSubCategoryIds) {
          const subSubCategoryExists = await SubSubCategory.findById(
            subSubCatId
          );
          if (!subSubCategoryExists) {
            throw new Error(`SubSubCategory with ID ${subSubCatId} not found`);
          }
        }
      }
    }

    // Validate sizes if changed (handle both single and multiple)
    if (updateData.sizes) {
      const sizeIds = Array.isArray(updateData.sizes)
        ? updateData.sizes
        : [updateData.sizes];

      // Check if sizes have changed
      const existingSizeIds = existingProduct.sizes
        ? Array.isArray(existingProduct.sizes)
          ? existingProduct.sizes.map((id) => id.toString())
          : [existingProduct.sizes.toString()]
        : [];

      const sizesChanged =
        JSON.stringify(sizeIds.sort()) !==
        JSON.stringify(existingSizeIds.sort());

      if (sizesChanged) {
        for (const sizeId of sizeIds) {
          const sizeExists = await Size.findById(sizeId);
          if (!sizeExists) {
            throw new Error(`Size with ID ${sizeId} not found`);
          }
        }
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {});
    cache.del("newArrivals");
    cache.del("trendingProducts");
    cache.del("featuredForFooter");
    cache.del("tabProducts");
    const output = {
      _status: true,
      _message: "Product updated successfully",
      _data: updatedProduct,
    };

    response.send(output);
  } catch (err) {
    const messages = [];

    if (err.errors) {
      for (let msg in err.errors) {
        if (err.errors[msg].message) {
          messages.push(err.errors[msg].message);
        }
      }
    } else {
      messages.push(err.message || "Something went wrong");
    }

    const output = {
      _status: false,
      _message: messages,
      _data: null,
    };

    response.send(output);
  }
};

// Delete Product
exports.destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.send({
        _status: false,
        _message: "Product not found",
        _data: null,
      });
    }
    product.deletedAt = Date.now();
    await Product.findByIdAndUpdate(
      id,
      { deletedAt: Date.now() },
      { new: true }
    );
    cache.del("newArrivals");
    cache.del("trendingProducts");
    cache.del("featuredForFooter");
    cache.del("tabProducts");
    res.send({
      _status: true,
      _message: "Product deleted successfully",
      _data: product,
    });
  } catch (err) {
    res.send({
      _status: false,
      _message: err.message || "Something went wrong",
      _data: null,
    });
  }
};

exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.updateMany(
      {
        _id: id,
      },
      [
        {
          $set: {
            status: {
              $not: "$status",
            },
          },
        },
      ]
    );

    if (!product) {
      return res.send({
        _status: false,
        _message: "Product not found",
        _data: null,
      });
    }
    cache.del("newArrivals");
    cache.del("trendingProducts");
    cache.del("featuredForFooter");
    cache.del("tabProducts");
    res.send({
      _status: true,
      _message: "Product status changed successfully",
      _data: product,
    });
  } catch (err) {
    res.send({
      _status: false,
      _message: err.message || "Something went wrong",
      _data: null,
    });
  }
};

// Get Products by Category
exports.getByCategory = async (request, response) => {
  try {
    let { categoryId, subCategoryId, subSubCategoryId } = request.params;
    const { page = 1, limit = 20, sort = "-createdAt" } = request.query;

    // Convert single categoryId to array if it's not already
    const categoryIds = Array.isArray(categoryId) ? categoryId : [categoryId];
    const subCategoryIds = Array.isArray(subCategoryId)
      ? subCategoryId
      : [subCategoryId];
    const subSubCategoryIds = Array.isArray(subSubCategoryId)
      ? subSubCategoryId
      : [subSubCategoryId];

    const skip = (page - 1) * limit;

    // Find products where any of the categories match
    const products = await Product.find({
      $or: [
        { category: { $in: categoryIds } },
        { subCategory: { $in: subCategoryIds } },
        { subSubCategory: { $in: subSubCategoryIds } },
      ],
    })
      .populate("colors", "name code")
      .populate("material", "name ")
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .populate("subSubCategory", "name slug")
      .populate("sizes", "name")
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Product.countDocuments({
      category: { $in: categoryIds },
    });

    const output = {
      _status: true,
      _message: "Products fetched successfully",
      _data: products,
      _pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };

    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: err.message || "Something went wrong",
      _data: [],
    };

    response.send(output);
  }
};

// Get Filtered Products
exports.getProductByFilter = async (request, response) => {
  try {
    const {
      limit = 10,
      isFeatured,
      isNewArrival,
      isBestSeller,
      isTopRated,
      isUpsell,
      isOnSale,
      category,
      subCategory,
      subSubCategory,
    } = request.body;

    const query = {};

    // Add filter conditions if they are provided
    if (isFeatured !== undefined) query.isFeatured = isFeatured;
    if (isNewArrival !== undefined) query.isNewArrival = isNewArrival;
    if (isBestSeller !== undefined) query.isBestSeller = isBestSeller;
    if (isTopRated !== undefined) query.isTopRated = isTopRated;
    if (isUpsell !== undefined) query.isUpsell = isUpsell;
    if (isOnSale !== undefined) query.isOnSale = isOnSale;

    // Handle category filters
    if (category) {
      query.category = Array.isArray(category) ? { $in: category } : category;
    }
    if (subCategory) {
      query.subCategory = Array.isArray(subCategory)
        ? { $in: subCategory }
        : subCategory;
    }
    if (subSubCategory) {
      query.subSubCategory = Array.isArray(subSubCategory)
        ? { $in: subSubCategory }
        : subSubCategory;
    }

    const products = await Product.find(query)
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .populate("subSubCategory", "name slug")
      .populate("sizes", "name")
      .limit(Number(limit))
      .sort("-createdAt");

    const output = {
      _status: true,
      _message: "Filtered products fetched successfully",
      _data: products,
    };

    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: err.message || "Something went wrong",
      _data: [],
    };

    response.send(output);
  }
};

// Update Stock
exports.updateStock = async (request, response) => {
  try {
    const { id, stock } = request.body;

    if (stock === undefined || stock < 0) {
      throw new Error("Invalid stock value");
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { stock: Number(stock) },
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new Error("Product not found");
    }

    const output = {
      _status: true,
      _message: "Stock updated successfully",
      _data: product,
    };

    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: err.message || "Something went wrong",
      _data: null,
    };

    response.send(output);
  }
};
