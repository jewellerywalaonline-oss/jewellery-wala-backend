const faq = require("../../models/faq");
const cache = require("../../lib/cache");
exports.faqController = async (req, res) => {
  try {
    const faqDataCache = await cache.get("faqData");
    if (faqDataCache) {
      return res.status(200).json({
        _status: true,
        _message: "Faq Data",
        _data: faqDataCache,
      });
    }
    const faqData = await faq.find({
      status: true,
      deletedAt: null,
    });
    cache.set("faqData", faqData);
    res.status(200).json({
      _status: true,
      _message: "Faq Data",
      _data: faqData,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: error.message,
    });
  }
};
