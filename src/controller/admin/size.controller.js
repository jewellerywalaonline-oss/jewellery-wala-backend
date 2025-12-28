const size = require("../../models/size");
const cache = require("../../lib/cache");
// create
exports.create = async (request, response) => {
  try {
    const data = new size(request.body);
    const ress = await data.save();

    return response.status(201).json({
      _status: true,
      _message: "Data Inserted",
      _data: ress,
    });
  } catch (err) {
    // Handle validation errors
    if (err.name === "ValidationError") {
      const messages = [];
      for (let msg in err.errors) {
        if (err.errors[msg].message) {
          messages.push(err.errors[msg].message);
        }
      }

      return response.status(400).json({
        _status: false,
        _message: messages,
        _data: [],
      });
    }
    cache.del("sizeData");
    // Handle other errors
    return response.status(500).json({
      _status: false,
      _message: "Internal Server Error",
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
    }

    if (request.body != undefined) {
      if (request.body.name != undefined) {
        const name = new RegExp(request.body.name, "i");
        orCondition.push({ name: name });
      }
    }

    if (orCondition.length > 0) {
      filter.$or = orCondition;
    }

    const ress = await size.find(filter).sort({ order: "asc", _id: "desc" });

    return response.status(200).json({
      _status: ress.length > 0,
      _message: ress.length > 0 ? "Data Found" : "No Data Found",
      _data: ress.length > 0 ? ress : [],
    });
  } catch (err) {
    return response.status(500).json({
      _status: false,
      _message: "Something Went Wrong",
      _data: err.message || err,
    });
  }
};

// soft delete
exports.destroy = async (request, response) => {
  try {
    if (!request.body.id) {
      return response.status(400).json({
        _status: false,
        _message: "ID is required",
        _data: null,
      });
    }

    const result = await size.updateMany(
      {
        _id: request.body.id,
      },
      {
        $set: {
          deletedAt: Date.now(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return response.status(404).json({
        _status: false,
        _message: "No Data Found",
        _data: null,
      });
    }
    cache.del("sizeData");
    return response.status(200).json({
      _status: true,
      _message: "Data Deleted",
      _data: result,
    });
  } catch (err) {
    return response.status(500).json({
      _status: false,
      _message: "Failed to delete data",
      _data: err.message || null,
    });
  }
};

// get details
exports.details = async (request, response) => {
  try {
    if (!request.body.id) {
      return response.status(400).json({
        _status: false,
        _message: "ID is required",
        _data: null,
      });
    }

    const result = await size.findById({
      _id: request.body.id,
    });

    if (!result) {
      return response.status(404).json({
        _status: false,
        _message: "No Data Found",
        _data: null,
      });
    }

    return response.status(200).json({
      _status: true,
      _message: "Data Found",
      _data: result,
    });
  } catch (err) {
    return response.status(500).json({
      _status: false,
      _message: "Failed to fetch data",
      _data: err.message || null,
    });
  }
};

// update
exports.update = async (request, response) => {
  try {
    const id = request.params.id;

    if (!id) {
      return response.status(400).json({
        _status: false,
        _message: "ID is required",
        _data: null,
      });
    }

    const ress = await size.updateOne(
      {
        _id: id,
      },
      {
        $set: request.body,
      }
    );

    if (ress.matchedCount === 0) {
      return response.status(404).json({
        _status: false,
        _message: "No Data Found",
        _data: null,
      });
    }
    cache.del("sizeData");
    return response.status(200).json({
      _status: true,
      _message: "Data Updated",
      _data: ress,
    });
  } catch (err) {
    // Handle validation errors
    if (err.name === "ValidationError") {
      const messages = [];
      for (let msg in err.errors) {
        if (err.errors[msg].message) {
          messages.push(err.errors[msg].message);
        }
      }

      return response.status(400).json({
        _status: false,
        _message: messages,
        _data: null,
      });
    }

    return response.status(500).json({
      _status: false,
      _message: "Failed to update data",
      _data: err.message || null,
    });
  }
};

// change status
exports.changeStatus = async (request, response) => {
  try {
    if (!request.body.id) {
      return response.status(400).json({
        _status: false,
        _message: "ID is required",
        _data: null,
      });
    }

    const result = await size.updateMany(
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

    if (result.matchedCount === 0) {
      return response.status(404).json({
        _status: false,
        _message: "No Data Found",
        _data: null,
      });
    }
    cache.del("sizeData");
    return response.status(200).json({
      _status: true,
      _message: "Status Changed",
      _data: result,
    });
  } catch (err) {
    return response.status(500).json({
      _status: false,
      _message: "Failed to change status",
      _data: err.message || null,
    });
  }
};
