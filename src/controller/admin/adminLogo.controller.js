const logoModal = require("../../models/logo");
const { uploadToR2 } = require("../../lib/cloudflare");
const cache = require("../../lib/cache");

// create logo
exports.create = async (req, res) => {
  try {
    const data = { ...req.body };

    // Upload image to Cloudflare R2 if file exists
    if (req.file) {
      const uploadResult = await uploadToR2(req.file, "logos");

      if (uploadResult.success) {
        data.logo = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const logo = await logoModal.create(data);
    cache.del("logoData");
    const output = {
      _status: true,
      _message: "Logo Created Successfully",
      _data: logo,
    };

    res.status(201).json(output);
  } catch (error) {
    const output = {
      _status: false,
      _message: error.message || "Failed to create logo",
      _data: null,
    };

    res.status(500).json(output);
  }
};

// get all logos
exports.view = async (req, res) => {
  try {
    const logos = await logoModal
      .find({ deletedAt: null })
      .sort({ createdAt: "desc" });

    const output = {
      _status: logos.length > 0,
      _message: logos.length > 0 ? "Logos Found" : "No Logos Found",
      _data: logos.length > 0 ? logos : [],
    };

    res.status(200).json(output);
  } catch (error) {
    const output = {
      _status: false,
      _message: error.message || "Failed to fetch logos",
      _data: null,
    };

    res.status(500).json(output);
  }
};

// update logo
exports.update = async (req, res) => {
  try {
    const data = { ...req.body };

    // Get existing logo to delete old image if new one is uploaded
    const existingLogo = await logoModal.findById(req.params.id);

    if (!existingLogo) {
      const output = {
        _status: false,
        _message: "Logo Not Found",
        _data: null,
      };
      return res.status(404).json(output);
    }

    // Upload new image to Cloudflare R2 if file exists
    if (req.file) {
      const uploadResult = await uploadToR2(req.file, "logos");

      if (uploadResult.success) {
        // Delete old image from R2 if exists

        data.logo = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const logo = await logoModal.findByIdAndUpdate(req.params.id, {
      $set: data,
    });

    const output = {
      _status: true,
      _message: "Logo Updated Successfully",
      _data: logo,
    };
    cache.del("logoData");
    res.status(200).json(output);
  } catch (error) {
    const output = {
      _status: false,
      _message: error.message || "Failed to update logo",
      _data: null,
    };

    res.status(500).json(output);
  }
};

// permanent delete logo (with image deletion from R2)
exports.destroy = async (req, res) => {
  try {
    const logo = await logoModal.findById(req.params.id);

    if (!logo) {
      const output = {
        _status: false,
        _message: "Logo Not Found",
        _data: null,
      };
      return res.status(404).json(output);
    }

    // Permanently delete from database
    logo.deletedAt = Date.now();
    await logo.save();

    const output = {
      _status: true,
      _message: "Logo Deleted Permanently",
      _data: logo,
    };
    cache.del("logoData");
    res.status(200).json(output);
  } catch (error) {
    const output = {
      _status: false,
      _message: error.message || "Failed to delete logo",
      _data: null,
    };

    res.status(500).json(output);
  }
};

// change status
exports.changeStatus = async (req, res) => {
  try {
    const logo = await logoModal.updateMany(
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
      _data: logo,
    };
    cache.del("logoData");
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
