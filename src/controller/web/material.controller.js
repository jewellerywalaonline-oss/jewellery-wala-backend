const material = require("../../models/material");
const cache = require("../../lib/cache");

exports.materialController = async (req, res) => {
  try {
    const materialDataCache = await cache.get("materialData");
    if (materialDataCache) {
      return res.status(200).json({
        _status: true,
        _message: "Material Data",
        _data: materialDataCache,
      });
    }
    const materialData = await material.find({
      status: true,
      deletedAt: null,
    });
    if (materialData.length > 0) {
      cache.set("materialData", materialData);
    }
    res.status(200).json({
      _status: true,
      _message: "Material Data",
      _data: materialData,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: error.message,
    });
  }
};
