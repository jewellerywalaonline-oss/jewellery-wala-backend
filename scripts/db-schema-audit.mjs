// Audit migrated local DB against new schemas — find fields that would fail validation
import mongoose from "mongoose";
import "dotenv/config";

const MONGO_URL = process.env.NEW_DB_URL || "mongodb://localhost:27017/jewelley_walla";

async function main() {
  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;

  console.log("=== PRODUCTS (required-field audit) ===");
  const prods = db.collection("products");

  // Required in new schema: name, slug, image, images, colors, material, category,
  // subCategory, description, weight, purity, price, discount_price, stock,
  // estimated_delivery_time, status, code
  const required = [
    "name", "slug", "image", "images", "colors", "material", "category",
    "subCategory", "description", "weight", "purity", "price", "discount_price",
    "stock", "estimated_delivery_time", "status", "code",
  ];
  for (const f of required) {
    const missing = await prods.countDocuments({
      $or: [{ [f]: { $exists: false } }, { [f]: null }, { [f]: "" }, { [f]: [] }],
    });
    console.log(`  ${missing === 0 ? "✅" : "❌"} ${f}: ${missing} missing`);
  }

  // status values that aren't in the enum
  const badStatus = await prods.countDocuments({ status: { $nin: ["active", "inactive", "draft"] } });
  console.log(`  ${badStatus === 0 ? "✅" : "❌"} status not in enum: ${badStatus}`);
  const badStatusTypes = await prods.aggregate([{ $group: { _id: { $type: "$status" }, count: { $sum: 1 } } }]).toArray();
  console.log("     status types:", JSON.stringify(badStatusTypes));

  // purity / weight types
  const weightTypes = await prods.aggregate([{ $group: { _id: { $type: "$weight" }, count: { $sum: 1 } } }]).toArray();
  console.log("     weight types:", JSON.stringify(weightTypes));
  const purityTypes = await prods.aggregate([{ $group: { _id: { $type: "$purity" }, count: { $sum: 1 } } }]).toArray();
  console.log("     purity types:", JSON.stringify(purityTypes));

  // sizes field
  const hasSizes = await prods.countDocuments({ sizes: { $exists: true } });
  console.log(`  ℹ️  products with sizes field: ${hasSizes}`);

  // price <= 0
  const badPrice = await prods.countDocuments({ price: { $lte: 0 } });
  console.log(`  ${badPrice === 0 ? "✅" : "❌"} price <= 0: ${badPrice}`);

  console.log("\n=== OTHER COLLECTIONS (status type consistency) ===");
  const collections = ["categories", "subcategories", "subsubcategories", "colors", "materials", "sizes", "banners", "testimonials", "homepages", "coupens", "faqs", "whychooseus", "productfaqs", "reviews", "users"];
  for (const c of collections) {
    const col = db.collection(c);
    if (!(await col.countDocuments())) {
      console.log(`  ℹ️  ${c}: empty/none`);
      continue;
    }
    const types = await col.aggregate([{ $group: { _id: { $type: "$status" }, count: { $sum: 1 } } }]).toArray();
    console.log(`  ${c}: status types = ${JSON.stringify(types)}`);
  }

  console.log("\n=== ORDERS / CARTS / WISHLISTS ===");
  const orders = db.collection("orders");
  const shiprocketFields = await orders.countDocuments({
    $or: [
      { "shipping.shiprocketOrderId": { $exists: true } },
      { "shipping.shiprocketShipmentId": { $exists: true } },
      { "shipping.rtoRequested": { $exists: true } },
    ],
  });
  console.log(`  orders with Shiprocket fields: ${shiprocketFields}`);
  const orderItemSizeId = await orders.countDocuments({ "items.sizeId": { $exists: true } });
  console.log(`  orders with sizeId on items: ${orderItemSizeId}`);
  const carts = db.collection("carts");
  const cartSize = await carts.countDocuments({ "items.size": { $exists: true } });
  console.log(`  carts with size on items: ${cartSize}`);

  // users schema check — mobile/password fields
  const users = db.collection("users");
  const userNoEmail = await users.countDocuments({ $or: [{ email: { $exists: false } }, { email: "" }] });
  console.log(`  users without email: ${userNoEmail}`);

  await mongoose.disconnect();
  console.log("\nDONE");
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
