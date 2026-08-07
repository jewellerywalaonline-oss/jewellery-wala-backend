import WhyChooseUs from "../../models/whyChooseUs.js";
import { buildCacheListController } from "./_helpers.js";

export const whyChooseUsController = buildCacheListController(WhyChooseUs, {
  cacheKey: "whyChooseUsData",
  ttl: 3600, // 1 hour — content rarely changes, cache invalidated on admin CRUD
});