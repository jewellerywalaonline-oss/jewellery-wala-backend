const color = require("../../models/color");
const cache = require("../../lib/cache");
exports.colorController = async (req, res) => {
  try {
    const colorDataCache = await cache.get("colorData");
    if (colorDataCache) { 
      return res.status(200).json({
        _status: true,
        _message: "Color Data",
        _data: colorDataCache,
      });
    }
    const colorData = await color
      .find({
        status: true,
        deletedAt: null,
      })
      .lean();
    cache.set("colorData", colorData);
    res.status(200).json({
      _status: true,
      _message: "Color Data",
      _data: colorData,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: error.message,
    });
  }
};
