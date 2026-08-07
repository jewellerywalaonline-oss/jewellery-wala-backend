// Test the web proxy path (port 3000) exactly as the browser would
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import "dotenv/config";

const BASE = "http://localhost:3000/api/website";

async function main() {
  await mongoose.connect(process.env.NEW_DB_URL || "mongodb://localhost:27017/jewelley_walla", {
    serverSelectionTimeoutMS: 4000,
  });
  const db = mongoose.connection.db;
  const cart = await db.collection("carts").findOne({});
  let user = null;
  if (cart) user = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(String(cart.user)) });
  if (!user) user = await db.collection("users").findOne({});
  if (!user) { console.log("❌ No users"); await mongoose.disconnect(); return; }

  const secret = process.env.JWT_SECRET;
  const token = jwt.sign({ _id: String(user._id), role: user.role || "user" }, secret, { expiresIn: "1h" });
  const h = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

  const active = await db.collection("products").findOne({ deletedAt: null, status: "active" });
  const pid = String(active._id);

  console.log("=== THROUGH WEB PROXY (port 3000) ===");
  console.log("User:", user.email, "| Product:", active.name.slice(0, 30));

  let r = await fetch(BASE + "/cart/view", { headers: h });
  console.log("GET  /cart/view    ->", r.status, (await r.text()).slice(0, 60));

  r = await fetch(BASE + "/cart/add", { method: "POST", headers: h, body: JSON.stringify({ productId: pid, quantity: 1 }) });
  console.log("POST /cart/add     ->", r.status, (await r.text()).slice(0, 60));

  r = await fetch(BASE + "/wishlist/view", { headers: h });
  console.log("GET  /wishlist/view ->", r.status, (await r.text()).slice(0, 60));

  r = await fetch(BASE + "/product/all");
  console.log("GET  /product/all  ->", r.status);

  r = await fetch(BASE + "/nav");
  console.log("GET  /nav          ->", r.status);

  r = await fetch(BASE + "/home-page");
  console.log("GET  /home-page    ->", r.status);

  r = await fetch(BASE + "/user/profile", { headers: h });
  console.log("GET  /user/profile ->", r.status);

  r = await fetch(BASE + "/testimonial");
  console.log("GET  /testimonial  ->", r.status);

  await mongoose.disconnect();
  console.log("DONE");
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
