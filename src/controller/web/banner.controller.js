const banner = require("../../models/banner");
const cache = require("../../lib/cache");

exports.bannerController = async (req, res) => {
  try {
    const bannerDataCache = cache.get("bannerData");
    if (bannerDataCache) {
      return res.status(200).json({
        _status: true,
        _message: "Banner Data",
        _data: bannerDataCache,
      });
    }
    const bannerData = await banner
      .find({
        status: true,
        deletedAt: null,
      })
      .lean();
    cache.set("bannerData", bannerData);
    res.status(200).json({
      _status: true,
      _message: "Banner Data",
      _data: bannerData,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: error.message,
    });
  }
};
