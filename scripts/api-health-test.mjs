// API health test — logs in with a real user and exercises the main website endpoints
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import "dotenv/config";

const BASE = "http://localhost:5000";

async function main() {
  await mongoose.connect(process.env.NEW_DB_URL || "mongodb://localhost:27017/jewelley_walla", {
    serverSelectionTimeoutMS: 4000,
  });
  const db = mongoose.connection.db;

  // Find a user that actually has a cart (most realistic)
  const cart = await db.collection("carts").findOne({});
  let user = null;
  if (cart) {
    user = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(String(cart.user)) });
  }
  if (!user) user = await db.collection("users").findOne({});
  if (!user) {
    console.log("❌ No users in DB");
    await mongoose.disconnect();
    return;
  }

  const secret = process.env.JWT_SECRET;
  const token = jwt.sign({ _id: String(user._id), role: user.role || "user" }, secret, { expiresIn: "1h" });
  const h = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

  const active = await db.collection("products").findOne({ deletedAt: null, status: "active" });
  if (!active) {
    console.log("❌ No active products in DB");
    await mongoose.disconnect();
    return;
  }
  const pid = String(active._id);

  console.log("User:", user.email, "| role:", user.role);
  console.log("Product:", active.name.slice(0, 40), "| status:", active.status, "| stock:", active.stock);
  console.log("--------------------------------------------------");

  // 1. cart/view
  let r = await fetch(BASE + "/api/website/cart/view", { headers: h });
  console.log("GET  /cart/view          ->", r.status, (await r.text()).slice(0, 80));

  // 2. cart/add
  r = await fetch(BASE + "/api/website/cart/add", {
    method: "POST", headers: h,
    body: JSON.stringify({ productId: pid, quantity: 1 }),
  });
  console.log("POST /cart/add           ->", r.status, (await r.text()).slice(0, 80));

  // 3. wishlist/add
  r = await fetch(BASE + "/api/website/wishlist/add", {
    method: "POST", headers: h,
    body: JSON.stringify({ productId: pid }),
  });
  console.log("POST /wishlist/add       ->", r.status, (await r.text()).slice(0, 80));

  // 4. wishlist/view
  r = await fetch(BASE + "/api/website/wishlist/view", { headers: h });
  console.log("GET  /wishlist/view      ->", r.status, (await r.text()).slice(0, 80));

  // 5. create order (cart)
  r = await fetch(BASE + "/api/website/orders/create", {
    method: "POST", headers: h,
    body: JSON.stringify({
      purchaseType: "direct",
      items: [{ productId: pid, colorId: null, quantity: 1 }],
      shippingAddress: {
        fullName: "Test User", phone: "9876543210", email: user.email,
        area: "Test Area", street: "Test Street", city: "Jodhpur",
        state: "Rajasthan", pincode: "342005",
      },
      idempotencyKey: crypto.randomUUID ? crypto.randomUUID() : "test-" + Date.now(),
    }),
  });
  console.log("POST /orders/create      ->", r.status, (await r.text()).slice(0, 120));

  // 6. user profile
  r = await fetch(BASE + "/api/website/user/profile", { headers: h });
  console.log("GET  /user/profile       ->", r.status);

  // 7. product listing
  r = await fetch(BASE + "/api/website/product/all");
  console.log("GET  /product/all        ->", r.status);

  // 8. home page
  r = await fetch(BASE + "/api/website/home-page");
  console.log("GET  /home-page          ->", r.status);

  await mongoose.disconnect();
  console.log("--------------------------------------------------");
  console.log("DONE");
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
