const testimonial = require("../../models/testimonial");
const cache = require("../../lib/cache");
exports.testimonialController = async (req, res) => {
  try {
    const testimonialDataCache = await cache.get("testimonialData");
    if (testimonialDataCache) {
      return res.status(200).json({
        _status: true,
        _message: "Testimonial Data",
        _data: testimonialDataCache,
      });
    }
    const testimonialData = await testimonial.find({
      status: true,
      deletedAt: null,
    });
    cache.set("testimonialData", testimonialData);
    res.status(200).json({
      _status: true,
      _message: "Testimonial Data",
      _data: testimonialData,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: error.message,
    });
  }
};
