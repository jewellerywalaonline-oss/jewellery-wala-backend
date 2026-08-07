import Logo from "../../models/logo.js";
import { buildCacheListController } from "./_helpers.js";

export const logoController = buildCacheListController(Logo, {
  cacheKey: "logoData",
  ttl: 3600, // 1 hour — logos rarely change, cache is invalidated on admin CRUD
});