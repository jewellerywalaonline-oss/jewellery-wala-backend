import Faq from "../../models/faq.js";
import { buildCacheListController } from "./_helpers.js";

export const faqController = buildCacheListController(Faq, {
  cacheKey: "faqData",
  ttl: 3600, // 1 hour — FAQs rarely change, cache invalidated on admin CRUD
});