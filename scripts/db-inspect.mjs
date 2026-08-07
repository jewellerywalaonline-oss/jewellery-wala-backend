import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const url = process.argv[2] ?? process.env.NEW_DB_URL ?? "mongodb://localhost:27017/jewelley_walla";

mongoose.connect(url, { serverSelectionTimeoutMS: 8000 })
  .then(async () => {
    const db = mongoose.connection.db;
    const cols = (await db.listCollections().toArray()).map((c) => c.name).sort();
    console.log("COLLECTIONS:", cols.join(", "));

    const prod = db.collection("products");
    console.log("\n-- products --");
    console.log("total:", await prod.countDocuments());
    console.log("status by type:", JSON.stringify(await prod.aggregate([{ $group: { _id: { $type: "$status" }, count: { $sum: 1 } } }]).toArray()));
    const sample = await prod.find({}, { projection: { status: 1, name: 1, deletedAt: 1 } }).limit(3).toArray();
    console.log("sample:", JSON.stringify(sample, null, 1));

    const hp = db.collection("homepages");
    console.log("\n-- homepages --");
    console.log("count:", await hp.countDocuments());
    const hpDoc = await hp.findOne();
    if (hpDoc) {
      console.log("sections:", hpDoc.sections?.length, "types:", JSON.stringify((hpDoc.sections ?? []).map((s) => s.type)));
    }

    const carts = db.collection("carts");
    console.log("\n-- carts --");
    console.log("count:", await carts.countDocuments());
    const cartSample = await carts.findOne();
    if (cartSample) {
      console.log("user:", String(cartSample.user), "items:", cartSample.items?.length);
      console.log("first item keys:", JSON.stringify(Object.keys(cartSample.items?.[0] ?? {})));
    }

    const wish = db.collection("wishlists");
    console.log("\n-- wishlists --");
    console.log("count:", await wish.countDocuments());

    for (const c of ["sizes", "colors", "materials", "categories", "subcategories", "users"]) {
      const col = db.collection(c);
      console.log(`\n-- ${c} --`);
      console.log("count:", await col.countDocuments());
      const s = await col.findOne();
      if (s) console.log("sample keys:", JSON.stringify(Object.keys(s).slice(0, 20)));
    }

    await mongoose.disconnect();
  })
  .catch((e) => {
    console.log("ERR:", e.message);
    process.exit(1);
  });
