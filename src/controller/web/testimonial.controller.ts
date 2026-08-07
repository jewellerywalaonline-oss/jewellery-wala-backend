import Testimonial from "../../models/testimonial.js";
import { buildCacheListController } from "./_helpers.js";

export const testimonialController = buildCacheListController(Testimonial, {
  cacheKey: "testimonialData",
  ttl: 3600, // 1 hour — testimonials rarely change, cache invalidated on admin CRUD
});