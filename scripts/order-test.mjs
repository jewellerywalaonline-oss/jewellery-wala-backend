// Order creation test with a valid color — mimics the real frontend flow
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import "dotenv/config";

const BASE = "http://localhost:5000/api/website";

async function main() {
  await mongoose.connect(process.env.NEW_DB_URL || "mongodb://localhost:27017/jewelley_walla", {
    serverSelectionTimeoutMS: 4000,
  });
  const db = mongoose.connection.db;

  let user = await db.collection("users").findOne({});
  const secret = process.env.JWT_SECRET;
  const token = jwt.sign({ _id: String(user._id), role: user.role || "user" }, secret, { expiresIn: "1h" });
  const h = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

  // Find an active product WITH a valid color
  const products = await db.collection("products")
    .find({ deletedAt: null, status: "active", colors: { $exists: true, $ne: [] } })
    .limit(3)
    .toArray();

  console.log("=== ORDER CREATE TEST (valid color) ===");
  for (const p of products) {
    const colorId = Array.isArray(p.colors) && p.colors.length ? String(p.colors[0]) : null;
    const sizeId = Array.isArray(p.sizes) && p.sizes.length ? String(p.sizes[0]) : null;
    console.log("Product:", p.name.slice(0, 30), "| colorId:", colorId ? colorId.slice(0, 8) : "NONE", "| sizeId:", sizeId ? sizeId.slice(0, 8) : "-");

    const r = await fetch(BASE + "/orders/create", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        purchaseType: "direct",
        items: [{ productId: String(p._id), colorId: colorId, quantity: 1, sizeId: sizeId }],
        shippingAddress: {
          fullName: "Test User", phone: "9876543210", email: user.email,
          area: "Test Area", street: "Test Street", city: "Jodhpur",
          state: "Rajasthan", pincode: "342005",
        },
        idempotencyKey: "test-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      }),
    });
    const body = await r.text();
    console.log("  ->", r.status, body.slice(0, 150));
    console.log();
    if (r.status === 201) break; // one successful order is enough
  }

  await mongoose.disconnect();
  console.log("DONE");
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
