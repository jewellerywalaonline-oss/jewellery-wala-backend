import Material from "../../models/material.js";
import { buildCacheListController } from "./_helpers.js";

export const materialController = buildCacheListController(Material, {
  cacheKey: "materialData",
  ttl: 3600, // 1 hour — materials rarely change, cache invalidated on admin CRUD
});