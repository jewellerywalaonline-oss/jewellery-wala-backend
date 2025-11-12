const express = require("express");
const router = express.Router();
const { getSearchWithSuggestions } = require("../../controller/web/suggestion.controller");

// Main search endpoint
router.get("/suggestion", getSearchWithSuggestions);

module.exports = router;

/*
GET /api/products/search?search=bracelet&limit=6

Response:
{
  "_status": true,
  "_message": "Search results fetched successfully",
  "_data": {
    "suggestions": [                    // LEFT SIDE
      "bracelet",
      "bracelet for men",
      "bracelet for women",
      "gold bracelet",
      "silver bracelet",
      "diamond bracelet",
      "bracelet design",
      "men bracelet"
    ],
    "products": [                       // RIGHT SIDE
      {
        "_id": "...",
        "name": "Gold Bracelet for Men",
        "slug": "gold-bracelet-men",
        "image": "...",
        "images": [...],
        "price": 25000,
        "discount_price": 22000,
        "stock": 10,
        "description": "Beautiful gold bracelet...",
        "category": { "name": "Bracelets", "slug": "bracelets" },
        "subCategory": { "name": "Men's Jewelry", "slug": "mens-jewelry" },
        "colors": [{ "name": "Gold", "code": "#FFD700" }],
        "material": { "name": "Gold" }
      },
      // ... 5 more products
    ],
    "searchTerm": "bracelet"
  }
}
*/
