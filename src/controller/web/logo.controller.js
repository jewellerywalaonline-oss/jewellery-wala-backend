const logo = require("../../models/logo");
const cache = require("../../lib/cache");

exports.logoController = async (req, res) => {
  try {
    const logoDataCache = cache.get("logoData");
    if (logoDataCache) {
      return res.status(200).json({
        _status: true,
        _message: "Logo Data",
        _data: logoDataCache,
      });
    }
    const logoData = await logo.find().lean();
    cache.set("logoData", logoData);

    res.status(200).json({
      _status: true,
      _message: "Logo Data",
      _data: logoData,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: error.message,
    });
  }
};
