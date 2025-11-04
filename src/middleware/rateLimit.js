// middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");

module.exports = {
  register: rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 15, 
    message: "Too many tries to Register, please try again later"
  }),
  
  login: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, 
    message: "Too many tries to Login, please try again later"
  }) ,
  updateProfile: rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5, 
    
    message: "Too many tries to Update Profile, please try again later"
  }) ,
  passwordReset: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 25,
    message: "Too many tries to Reset Password, please try again later"
  }),
  sendDeliveryOTP: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 15,
    message: "Too many tries to Send Delivery OTP, please try again later"
  })
};