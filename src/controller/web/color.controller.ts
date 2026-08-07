import Color from "../../models/color.js";
import { buildCacheListController } from "./_helpers.js";

export const colorController = buildCacheListController(Color, {
  cacheKey: "colorData",
  ttl: 3600, // 1 hour — colors rarely change, cache invalidated on admin CRUD
});