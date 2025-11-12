const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const compression = require("compression");
require("dotenv").config();
const app = express();

// parse requests of content-type - application/json
app.use((req, res, next) => {
  if (req.originalUrl === "/api/orders/webhook") {
    next(); // Skip JSON parsing for webhook
  } else {
    express.json()(req, res, next);
  }
});

// npm install express body-parser
app.use(bodyParser.json());

app.use(cors());
// {
//     origin: [
//       "http://localhost:3000",
//       "https://jewellery-wala-adminpanel.vercel.app",
//       "https://jewellerywalla.com",
//     ],
//     credentials: true,
//     allowedHeaders: "*",
//     methods: "*",
//   }

app.use(express.urlencoded({ extended: true }));

const userRoutes = require("./src/routes/web/user.route");
const productRoutes = require("./src/routes/web/product.routes");
const cartRoutes = require("./src/routes/web/cart.routes");
const wishlistRoutes = require("./src/routes/web/wishlist.routes");
const navRoutes = require("./src/routes/web/nav.routes");
const faqRoutes = require("./src/routes/web/faq.routes");
const testimonialRoutes = require("./src/routes/web/testimonial.routes");
const logoRoutes = require("./src/routes/web/logo.routes");
const bannerRoutes = require("./src/routes/web/banner.routes");
const reviewRoutes = require("./src/routes/web/review.routes");
const whyChooseUsRoutes = require("./src/routes/web/whyChooseUs.routes");
const webColorRoutes = require("./src/routes/web/color.routes");
const webMaterialRoutes = require("./src/routes/web/material.routes");
const orderRoutes = require("./src/routes/web/order.routes");
const contactRoutes = require("./src/routes/web/contact.routes");
const suggestionRoutes = require("./src/routes/web/suggestion.routes");
// admin routes variables
const materialRoutes = require("./src/routes/admin/material.routes");
const colorRoutes = require("./src/routes/admin/color.routes");
const userAdminRoutes = require("./src/routes/admin/userAdmin.routes");
const adminCategoryRoutes = require("./src/routes/admin/adminCategory.routes");
const adminSubCategoryRoutes = require("./src/routes/admin/adminSubCat.routes");
const adminSubSubCategoryRoutes = require("./src/routes/admin/adminSubSubCat.routes");
const adminFaqRoutes = require("./src/routes/admin/adminFaq.routes");
const adminBannerRoutes = require("./src/routes/admin/adminBanner.routes");
const adminTestimonialRoutes = require("./src/routes/admin/adminTestimonial.routes");
const adminLogoRoutes = require("./src/routes/admin/adminLogo.routes");
const adminProductRoutes = require("./src/routes/admin/adminProduct.routes");
const adminReviewRoutes = require("./src/routes/admin/adminReview.routes");
const adminWhyChooseUsRoutes = require("./src/routes/admin/adminWhyChooseUs.routes");
const dashboardRoutes = require("./src/routes/admin/dashboard.routes");
// website routes
app.use("/api/website/logo", logoRoutes);
app.use("/api/website/banner", bannerRoutes);
app.use("/api/website/nav", navRoutes);
app.use("/api/website/user", userRoutes);
app.use("/api/website/product", productRoutes);
app.use("/api/website/cart", cartRoutes);
app.use("/api/website/wishlist", wishlistRoutes);
app.use("/api/website/faq", faqRoutes);
app.use("/api/website/testimonial", testimonialRoutes);
app.use("/api/website/whyChooseUs", whyChooseUsRoutes);
app.use("/api/website/review", reviewRoutes);
app.use("/api/website/color", webColorRoutes);
app.use("/api/website/material", webMaterialRoutes);
app.use("/api/website/orders", orderRoutes);
app.use("/api/website/contact", contactRoutes);
app.use("/api/website/result", suggestionRoutes);
// admin routes
app.use("/api/admin/logo", adminLogoRoutes);
app.use("/api/admin/banner", adminBannerRoutes);
app.use("/api/admin/user", userAdminRoutes);
app.use("/api/admin/category", adminCategoryRoutes);
app.use("/api/admin/subcategory", adminSubCategoryRoutes);
app.use("/api/admin/subsubcategory", adminSubSubCategoryRoutes);
app.use("/api/admin/product", adminProductRoutes);
app.use("/api/admin/color", colorRoutes);
app.use("/api/admin/material", materialRoutes);
app.use("/api/admin/faq", adminFaqRoutes);
app.use("/api/admin/testimonial", adminTestimonialRoutes);
app.use("/api/admin/review", adminReviewRoutes);
app.use("/api/admin/whyChooseUs", adminWhyChooseUsRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);

// api routes
app.get("/", (req, res) => {
  res.send("server started");
});

app.listen(process.env.PORT, () => {
  mongoose
    .connect(process.env.NEW_DB_URL)
    .then(() => console.log("Connected!"))
    .catch((err) => {
      console.log(err);
    });
  console.log("serer is working");
});
