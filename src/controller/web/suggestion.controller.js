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

    const trimmedSearch = escapeRegex(search.trim().toLowerCase());

    // ==========================================
    // FETCH PRODUCTS (Right Side)
    // ==========================================

    const productQuery = {
      $and: [
        {
          $or: [
            { name: { $regex: trimmedSearch, $options: "i" } },
            { slug: { $regex: trimmedSearch, $options: "i" } },
            { description: { $regex: trimmedSearch, $options: "i" } },
          ],
        },
        { deletedAt: null },
        { status: true },
      ],
    };

    const products = await Product.find(productQuery)
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .populate("subSubCategory", "name slug")
      .populate("colors", "name code")
      .populate("material", "name")
      .select(
        "name slug images price image stock discount_price colors material category subCategory subSubCategory description"
      )
      .sort("-createdAt")
      .limit(parsedLimit)
      .lean();

    // ==========================================
    // GENERATE SEARCH TERM SUGGESTIONS (Left Side)
    // ==========================================

    const suggestionSet = new Set();

    // 1. Get broader dataset for suggestions (more products)
    const suggestionQuery = {
      $and: [
        {
          $or: [
            { name: { $regex: trimmedSearch, $options: "i" } },
            { description: { $regex: trimmedSearch, $options: "i" } },
            { slug: { $regex: trimmedSearch, $options: "i" } },
          ],
        },
        { deletedAt: null },
        { status: true },
      ],
    };

    const suggestionProducts = await Product.find(suggestionQuery)
      .populate("category", "name")
      .populate("subCategory", "name")
      .populate("subSubCategory", "name")
      .populate("material", "name")
      .select("name description category subCategory subSubCategory material")
      .limit(50)
      .lean();

    // 2. Extract keywords from product names
    suggestionProducts.forEach((product) => {
      // Add main search term
      suggestionSet.add(trimmedSearch);

      // Extract words from product name
      const nameWords = product.name.toLowerCase().split(/\s+/);
      nameWords.forEach((word) => {
        if (word.length > 2 && word.includes(trimmedSearch.substring(0, 3))) {
          suggestionSet.add(word);
        }
      });

      // Category-based suggestions
      if (product.category?.name) {
        const categoryName = product.category.name.toLowerCase();
        suggestionSet.add(categoryName);
        suggestionSet.add(`${trimmedSearch} for ${categoryName}`);
        suggestionSet.add(`${categoryName} ${trimmedSearch}`);
      }

      // SubCategory suggestions
      if (product.subCategory?.name) {
        const subCatName = product.subCategory.name.toLowerCase();
        suggestionSet.add(`${trimmedSearch} ${subCatName}`);
        suggestionSet.add(`${subCatName} ${trimmedSearch}`);
      }

      // Material-based suggestions
      if (product.material?.name) {
        const materialName = product.material.name.toLowerCase();
        suggestionSet.add(`${materialName} ${trimmedSearch}`);
        suggestionSet.add(`${trimmedSearch} ${materialName}`);
      }

      // Extract meaningful phrases from description
      if (product.description) {
        const descWords = product.description.toLowerCase().split(/\s+/);
        descWords.forEach((word, index) => {
          if (
            word.includes(trimmedSearch.substring(0, 3)) &&
            word.length > 3 &&
            word.length < 15
          ) {
            suggestionSet.add(word);
            // Add phrases (2-3 words)
            if (index < descWords.length - 1) {
              const phrase = `${word} ${descWords[index + 1]}`;
              if (phrase.length < 30) {
                suggestionSet.add(phrase);
              }
            }
          }
        });
      }
    });

    // 3. Smart filtering and ranking of suggestions
    let suggestions = Array.from(suggestionSet)
      .filter((suggestion) => {
        // Remove duplicates and clean up
        return (
          suggestion.length > 2 &&
          suggestion.length < 40 &&
          suggestion.trim() !== "" &&
          !suggestion.includes("  ") // No double spaces
        );
      })
      .map((suggestion) => {
        // Calculate relevance score
        let score = 0;

        // Exact match gets highest priority
        if (suggestion === trimmedSearch) score += 100;

        // Starts with search term
        if (suggestion.startsWith(trimmedSearch)) score += 50;

        // Contains search term
        if (suggestion.includes(trimmedSearch)) score += 25;

        // Shorter suggestions ranked higher (more specific)
        score += Math.max(0, 20 - suggestion.length);

        return { text: suggestion, score };
      })
      .sort((a, b) => b.score - a.score) // Sort by relevance
      .slice(0, 10) // Limit to top 10
      .map((item) => item.text);

    // 4. Add "for men", "for women", "for kids" variations if relevant
    const genderVariations = [];
    if (suggestionProducts.length > 0) {
      genderVariations.push(`${trimmedSearch} for men`);
      genderVariations.push(`${trimmedSearch} for women`);
      genderVariations.push(`${trimmedSearch} for kids`);
    }

    // Combine and deduplicate
    suggestions = [
      ...new Set([...suggestions.slice(0, 7), ...genderVariations]),
    ].slice(0, 10);

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
