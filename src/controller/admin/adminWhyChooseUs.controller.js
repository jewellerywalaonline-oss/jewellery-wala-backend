const whyChooseUs = require("../../models/whyChooseUs");
const { uploadToR2 } = require("../../lib/cloudflare");
const cache = require("../../lib/cache");
// create
exports.create = async (request, response) => {
  try {
    const data = new whyChooseUs(request.body);

    // Check if a JSX icon is provided instead of a file
    // Expecting the frontend to send something like: { icon: "<svg>...</svg>" } or a string key for the icon
    if (request.body.icon) {
      data.image = request.body.icon; // store the JSX/string/icon name
    } else if (request.file) {
      // fallback to real image upload if file exists
      const uploadResult = await uploadToR2(request.file, "whyChooseUs");

      if (uploadResult.success) {
        data.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const ress = await data.save();
    cache.del("whyChooseUsData");
    response.send({
      _status: true,
      _message: "Data Inserted",
      _data: ress,
    });
  } catch (err) {
    const messages = [];

    // Handle validation errors
    if (err.errors) {
      for (let msg in err.errors) {
        if (err.errors[msg].message) {
          messages.push(err.errors[msg].message);
        }
      }
    } else {
      messages.push(err.message || "Something went wrong");
    }

    response.send({
      _status: false,
      _message: messages,
      _data: [],
    });
  }
};


// view
exports.view = async (request, response) => {
  try {
   

    const andCondition = [{ deletedAt: null }];
    const orCondition = [];

    let filter = {};

    if (andCondition.length > 0) {
      filter.$and = andCondition;
    } else {
      filter = {};
    }

    if (request.body != undefined) {
      if (request.body.title != undefined) {
        const title = new RegExp(request.body.title, "i");
        orCondition.push({ title: title, description: title });
      }

      if (request.body.status != undefined) {
        andCondition.push({ status: request.body.status });
      }
    }

    if (orCondition.length > 0) {
      filter.$or = orCondition;
    }

    const totalRecords = await whyChooseUs.find(filter).countDocuments();

    const ress = await whyChooseUs
      .find(filter)
      .sort({ order: "asc", _id: "desc" })

    const output = {
      _status: ress.length > 0,
      _message: ress.length > 0 ? "Data Found" : "No Data Found",
      _data: ress.length > 0 ? ress : [],
    };

    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: "Something Went Wrong",
      _data: err.message || err,
    };

    response.send(output);
  }
};

// soft delete
exports.destroy = async (request, response) => {
  try {
    const result = await whyChooseUs.updateMany(
      {
        _id: request.body.id,
      },
      {
        $set: {
          deletedAt: Date.now(),
        },
      }
    );

    const output = {
      _status: true,
      _message: "Data Deleted",
      _data: result,
    };
    cache.del("whyChooseUsData");
    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: "No Data Deleted",
      _data: err.message || null,
    };

    response.send(output);
  }
};

// get details
exports.details = async (request, response) => {
  try {
    const result = await whyChooseUs.findById({
      _id: request.body.id,
    });

    const output = {
      _status: result ? true : false,
      _message: result ? "Data Found" : "No Data Found",
      _data: result,
    };

    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: "No Data Found",
      _data: err.message || null,
    };

    response.send(output);
  }
};

// update
exports.update = async (request, response) => {
  try {
    const id = request.params.id;
    const data = { ...request.body };

    // Check for JSX icon in request body
    if (request.body.icon) {
      data.image = request.body.icon; // save JSX/icon string
    } else if (request.file) {
      // fallback to real image upload
      const uploadResult = await uploadToR2(request.file, "whyChooseUs");

      if (uploadResult.success) {
        data.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const ress = await whyChooseUs.updateOne(
      { _id: id },
      { $set: data }
    );
    cache.del("whyChooseUsData");
    response.send({
      _status: true,
      _message: "Data Updated",
      _data: ress,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: err.message || "No Data Updated",
      _data: null,
    });
  }
};


// change status
exports.changeStatus = async (request, response) => {
  try {
    const result = await whyChooseUs.updateMany(
      {
        _id: request.body.id,
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
      _message: "Status Changed",
      _data: result,
    };
    cache.del("whyChooseUsData");
    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: "Status Not Changed",
      _data: err.message || null,
    };

    response.send(output);
  }
};
