const jwt = require("jsonwebtoken");
const User = require("../models/user");

const protect = async (req, res, next) => {
  let token;
  

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to req (exclude password field)
      req.user = await User.findById(decoded._id).select("-password");

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({
        _status: false,
        _message: "Not authorized, token Expired",
        _error: error,
      });
    }
  }else{
    return res.status(401).json({
      _status: false,
      _message: "Not authorized, no token",
    });
  }
};

module.exports = protect;
