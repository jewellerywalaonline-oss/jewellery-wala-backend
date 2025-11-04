const faqs = require("../../models/faq");
const cache = require("../../lib/cache");
// create
exports.create = async (request, response) => {
  try {
    const data = new faqs({...request.body});
    const ress = await data.save();

    const output = {
      _status: true,
      _message: "Data Inserted",
      _data: ress,
    };

    response.send(output);
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
    cache.del("faqData");
    const output = {
      _status: false,
      _message: messages,
      _data: [],
    };

    response.send(output);
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
      if (request.body.search != undefined) {
        const name = new RegExp(request.body.search, "i");
        orCondition.push({ question: name }, { answer: name });
      }
    }

    if (orCondition.length > 0) {
      filter.$or = orCondition;
    }

    const totalRecords = await faqs.find(filter).countDocuments();

    const ress = await faqs
      .find(filter)
      .select("_id question answer status order")
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
    const result = await faqs.updateMany(
      {
        _id: request.body.id,
      },
      {
        $set: {
          deletedAt: Date.now(),
        },
      }
    );
    cache.del("faqData");
    const output = {
      _status: true,
      _message: "Data Deleted",
      _data: result,
    };

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
    const result = await faqs.findById({
      _id: request.body.id,
    });

    const output = {
      _status: result ? true : false,
      _message: result ? "Data Found" : "Data Not Found",
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

    const ress = await faqs.updateOne(
      {
        _id: id,
      },
      {
        $set: {
          ...request.body,
          updated_at: Date.now(),
        },
      }
    );
    cache.del("faqData");
    const output = {
      _status: true,
      _message: "Data Updated",
      _data: ress,
    };

    response.send(output);
  } catch (err) {
    const output = {
      _status: false,
      _message: "No Data Updated",
      _data: err.message || null,
    };

    response.send(output);
  }
};

// change status
exports.changeStatus = async (request, response) => {
  try {
    const result = await faqs.updateMany(
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
    cache.del("faqData");
    const output = {
      _status: true,
      _message: "Status Changed",
      _data: result,
    };

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