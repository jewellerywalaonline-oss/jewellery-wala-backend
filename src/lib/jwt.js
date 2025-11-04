const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "10d",
    }
  );
};

const generateOtp = () => {
  // Generate a 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generatePasswordResetToken = (email, otp) => {
  return jwt.sign(
    { email, otp, type: "password_reset" },
    process.env.JWT_SECRET,
    { expiresIn: "10m" } // OTP expires in 10 minutes
  );
};

const verifyPasswordResetToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  generateOtp,
  generatePasswordResetToken,
  verifyPasswordResetToken,
};
