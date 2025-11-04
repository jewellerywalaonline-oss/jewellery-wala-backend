const whyChooseUs = require("../../models/whyChooseUs");
const cache = require("../../lib/cache");
exports.whyChooseUsController = async (req, res) => {
  try {
    const whyChooseUsDataCache = await cache.get("whyChooseUsData");
    if (whyChooseUsDataCache) {
      return res.status(200).json({
        _status: true,
        _message: "Why Choose Us Data",
        _data: whyChooseUsDataCache,
      });
    }
    const whyChooseUsData = await whyChooseUs.find({
      deletedAt: null,
      status: true,
    });
    cache.set("whyChooseUsData", whyChooseUsData);
    res.status(200).json({
      _status: true,
      _message: "Why Choose Us Data",
      _data: whyChooseUsData,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: error.message,
    });
  }
};
