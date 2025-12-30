const Product = require("../../models/product");

exports.getSearchWithSuggestions = async (req, res) => {
  try {
    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    const { search, limit = 6 } = req.query;
    const parsedLimit = parseInt(limit, 10) || 6;

    // Validate search term
    if (!search || search.trim() === "") {
      return res.send({
        _status: false,
        _message: "Search term is required",
        _data: {
          suggestions: [],
          products: [],
        },
      });
    }

    const trimmedSearch = search.trim();

    // Common stop words to filter out
    const stopWords = new Set([
      "for",
      "the",
      "a",
      "an",
      "and",
      "or",
      "of",
      "to",
      "in",
      "on",
      "with",
      "him",
      "her",
      "is",
      "it",
      "by",
    ]);

    // Split search term into words and filter out stop words
    const searchWords = trimmedSearch
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopWords.has(word.toLowerCase()))
      .map((word) => escapeRegex(word));

    // If all words were stop words, use the original search term
    const effectiveSearchWords =
      searchWords.length > 0 ? searchWords : [escapeRegex(trimmedSearch)];

    // Build regex patterns for product search
    const regexPatterns = effectiveSearchWords.map((word) => [
      { name: { $regex: word, $options: "i" } },
      { slug: { $regex: word, $options: "i" } },
    ]);

    // ==========================================
    // FETCH PRODUCTS (Right Side)
    // ==========================================

    const productQuery = {
      $and: [
        { $or: regexPatterns.flat() },
        { deletedAt: null },
        { status: true },
      ],
    };

    const products = await Product.find(productQuery)
      .populate({
        path: "category",
        select: "name slug",
        match: { deletedAt: null, status: true },
      })
      .populate({
        path: "subCategory",
        select: "name slug",
        match: { deletedAt: null, status: true },
      })
      .populate({
        path: "subSubCategory",
        select: "name slug",
        match: { deletedAt: null, status: true },
      })
      .populate({
        path: "colors",
        select: "name code",
        match: { deletedAt: null, status: true },
      })
      .populate({
        path: "material",
        select: "name",
        match: { deletedAt: null, status: true },
      })
      .select(
        "name slug images price image stock discount_price colors material category subCategory subSubCategory"
      )
      .sort({ order: -1, createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    // ==========================================
    // GENERATE PRODUCT NAME SUGGESTIONS (Left Side)
    // ==========================================

    // Fetch product names matching the search term
    const suggestionQuery = {
      $and: [
        { $or: regexPatterns.flat() },
        { deletedAt: null },
        { status: true },
      ],
    };

    const suggestionProducts = await Product.find(suggestionQuery)
      .select("name")
      .sort({ order: -1, createdAt: -1 })
      .limit(20)
      .lean();

    // Extract unique product names and rank by relevance
    const suggestions = suggestionProducts
      .map((product) => product.name)
      .filter((name, index, arr) => arr.indexOf(name) === index) // Remove duplicates
      .map((name) => {
        // Calculate relevance score
        let score = 0;
        const lowerName = name.toLowerCase();

        // Check each effective search word for relevance
        effectiveSearchWords.forEach((word) => {
          const lowerWord = word.toLowerCase();
          // Name starts with search word gets highest priority
          if (lowerName.startsWith(lowerWord)) score += 100;
          // Name contains search word
          else if (lowerName.includes(lowerWord)) score += 50;
        });

        // Shorter names ranked higher (more specific)
        score += Math.max(0, 50 - name.length);

        return { name, score };
      })
      .sort((a, b) => b.score - a.score) // Sort by relevance
      .slice(0, 10) // Limit to top 10
      .map((item) => item.name);

    // ==========================================
    // SEND RESPONSE
    // ==========================================

    res.send({
      _status: true,
      _message:
        products.length > 0
          ? "Search results fetched successfully"
          : "No products found",
      _data: {
        suggestions: suggestions, // Left side - search term suggestions
        products: products, // Right side - product results
        searchTerm: trimmedSearch,
      },
    });
  } catch (err) {
    console.error("Search error:", err);
    res.send({
      _status: false,
      _message: err.message || "Something went wrong",
      _data: {
        suggestions: [],
        products: [],
      },
    });
  }
};
