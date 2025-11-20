const coupenModel = require("../../models/coupen.js");

exports.coupenPopUp = async (req, res) => {
  try {
    const coupenId = req.params.id;

    const coupen = await coupenModel.findById(coupenId);

    if (!coupen) {
      return res.json({
        success: false,
        message: "Coupen Not Found",
      });
    }
    res.json({
      success: true,
      message: "Coupen Found",
      coupen,
    });
  } catch (error) {
    console.error("Coupen Pop Up Error:", error);
    res.json({
      success: false,
      message: "Couldnt Find Coupen",
    });
  }
};

exports.findCoupen = async (req, res) => {
  try {
    const userId = req.user._id;

    const coupen = await coupenModel.find({
      userId,
      deletedAt: null,
      status: true,
      isUsed: false,
    });

    if (!coupen) {
      return res.json({
        success: false,
        message: "Coupen Not Found",
      });
    }
    res.json({
      success: true,
      message: "Coupen Found",
      coupen,
    });
  } catch (error) {
    console.error("Coupen Pop Up Error:", error);
    res.json({
      success: false,
      message: "Couldnt Find Coupen",
    });
  }
};
