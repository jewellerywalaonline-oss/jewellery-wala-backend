const bannerModal = require("../../models/banner");
const cache = require("../../lib/cache");
const { uploadToR2 } = require("../../lib/cloudflare");
require("dotenv").config();

// create banner
module.exports.createBanner = async (req, res) => {
  try {
    const data = { ...req.body };

    // Upload image to Cloudflare R2 if file exists
    if (req.file) {
      const uploadResult = await uploadToR2(req.file, "banners");

      if (uploadResult.success) {
        data.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const banner = await bannerModal.create(data);

    const output = {
      _status: true,
      _message: "Banner Created Successfully",
      _data: banner,
    };

    res.status(201).json(output);
  } catch (error) {
    const output = {
      _status: false,
      _message: error.message || "Failed to create banner",
      _data: null,
    };

    res.status(500).json(output);
  }
};

// get all banners
module.exports.getAllBanner = async (req, res) => {
  try {
    let pageValue = 1;
    let limitValue = 10;
    let skipValue;

    const andCondition = [{ deletedAt: null }];
    const orCondition = [];

    let filter = {};

    if (andCondition.length > 0) {
      filter.$and = andCondition;
    } else {
      filter = {};
    }

    if (req.body != undefined) {
      pageValue = req.body.page ? req.body.page : 1;
      limitValue = req.body.limit ? req.body.limit : 10;
      skipValue = (pageValue - 1) * limitValue;

      if (req.body.description != undefined) {
        const description = new RegExp(req.body.description, "i");
        orCondition.push({ description: description });
      }

      if (req.body.status != undefined) {
        andCondition.push({ status: req.body.status });
      }
    }

    if (orCondition.length > 0) {
      filter.$or = orCondition;
    }

    const totalRecords = await bannerModal.find(filter).countDocuments();

    const banner = await bannerModal
      .find(filter)
      .sort({ order: "asc", _id: "desc" })
      .limit(limitValue)
      .skip(skipValue);

    const output = {
      _status: banner.length > 0,
      _message: banner.length > 0 ? "Banners Found" : "No Banners Found",
      _data: banner.length > 0 ? banner : [],
      _total_pages: Math.ceil(totalRecords / limitValue),
      _total_records: totalRecords,
      _current_page: Number(pageValue),
      
    };

    res.status(200).json(output);
  } catch (error) {
    const output = {
      _status: false,
      _message: error.message || "Failed to fetch banners",
      _data: null,
    };

    res.status(500).json(output);
  }
};


 // update banner
module.exports.updateBanner = async (req, res) => {
  try {
    const data = { ...req.body };

    // Upload new image to Cloudflare R2 if file exists
    if (req.file) {
      const uploadResult = await uploadToR2(req.file, "banners");

      if (uploadResult.success) {
        data.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }


    const banner = await bannerModal.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { new: true }
    );

    const output = {
      _status: banner ? true : false,
      _message: banner ? "Banner Updated Successfully" : "Banner Not Found",
      _data: banner,
    };

    res.status(200).json(output);
  } catch (error) {
    const output = {
      _status: false,
      _message: error.message || "Failed to update banner",
      _data: null,
    };

    res.status(500).json(output);
  }
};

// soft delete banner
module.exports.deleteBanner = async (req, res) => {
  try {
    const banner = await bannerModal.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          deletedAt: Date.now(),
        },
      },
      { new: true }
    );

    const output = {
      _status: banner ? true : false,
      _message: banner ? "Banner Deleted Successfully" : "Banner Not Found",
      _data: banner,
    };

    res.status(200).json(output);
  } catch (error) {
    const output = {
      _status: false,
      _message: error.message || "Failed to delete banner",
      _data: null,
    };

    res.status(500).json(output);
  }
};

// change status
module.exports.changeStatus = async (req, res) => {
  try {
    const banner = await bannerModal.updateMany(
      {
        _id: req.body.id,
      },
      [
        {
          $set: {
            status: {
              $not: "$status",
            },
          },
        },
      ]
    );

    const output = {
      _status: true,
      _message: "Status Changed Successfully",
      _data: banner,
    };

    res.status(200).json(output);
  } catch (error) {
    const output = {
      _status: false,
      _message: error.message || "Failed to change status",
      _data: null,
    };

    res.status(500).json(output);
  }
};
