const userModel = require("../../models/user");
const { generateToken } = require("../../lib/jwt");
const { hashPassword } = require("../../lib/bcrypt");
const { comparePassword } = require("../../lib/bcrypt");
const {
  generateOtp,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} = require("../../lib/jwt");
const { sendEmail } = require("../../lib/nodemailer");

const { uploadToR2, deleteFromR2 } = require("../../lib/cloudflare");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

module.exports.registerUser = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      _status: false,
      _message: "Please Give Name , Email and Password",
    });
  }
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        _status: false,
        _message: "All fields are required",
      });
    }

    const user = await userModel.findOne({ email });
    if (user) {
      return res.status(409).json({
        _status: false,
        _message: "User already exists",
      });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await userModel.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      _status: true,
      _message: "User registered successfully",
      _token: token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

module.exports.loginUser = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      _status: false,
      _message: "Please Give Email and Password",
    });
  }
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        _status: false,
        _message: "All fields are required",
      });
    }
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        _status: false,
        _message: "User not found",
      });
    }
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        _status: false,
        _message: "Incorrect password",
      });
    }
    const token = generateToken(user);
    return res.status(200).json({
      _status: true,
      _message: "User logged in successfully",
      _token: token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

module.exports.getProfile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      _status: false,
      _message: "Unauthorized",
    });
  }
  try {
    const user = await userModel.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({
        _status: false,
        _message: "User not found",
      });
    }
    return res.status(200).json({
      _status: true,
      _message: "User profile Found ",
      _data: user,
    });
  } catch (error) {
    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

module.exports.changePassword = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      _status: false,
      _message: "Unauthorized",
    });
  }
  try {
    const user = await userModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        _status: false,
        _message: "User not found",
      });
    }
    const isMatch = await comparePassword(req.body.oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        _status: false,
        _message: "Incorrect password",
      });
    }
    const hashedPassword = await hashPassword(req.body.newPassword);
    user.password = hashedPassword;
    await user.save();
    return res.status(200).json({
      _status: true,
      _message: "Password changed successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

module.exports.updateProfile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      _status: false,
      _message: "Unauthorized",
    });
  }
  try {
    const user = await userModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        _status: false,
        _message: "User not found",
      });
    }

    let avatarUrl = user.avatar;
    if (req.file) {
      try {
        // Upload new avatar to Cloudflare R2
        const uploadResult = await uploadToR2(req.file, "avatars");
        avatarUrl = uploadResult.url;

        // Remove the avatarFileId field as it's not needed with R2
      } catch (uploadError) {
        console.error("Avatar upload error:", uploadError);
        return res.status(500).json({
          _status: false,
          _message: "Failed to upload avatar",
        });
      }
    }

    // Update user fields
    if (req.body.name) user.name = req.body.name;
    if (req.body.address) user.address = JSON.parse(req.body.address);
    if (req.body.mobile) user.mobile = req.body.mobile;
    if (req.body.gender) user.gender = req.body.gender;

    if (req.body.pincode) user.address.pincode = req.body.pincode;
    if (req.body.street) user.address.street = req.body.street;
    if (req.body.city) user.address.city = req.body.city;
    if (req.body.state) user.address.state = req.body.state;
    if (req.body.area) user.address.area = req.body.area;
    if (req.body.instructions)
      user.address.instructions = req.body.instructions;

    user.avatar = avatarUrl;

    await user.save();

    return res.status(200).json({
      _status: true,
      _message: "User profile updated successfully",
      _data: user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

module.exports.forgotPassword = async (req, res) => {
  if (!req.body || !req.body.email) {
    return res.status(400).json({
      _status: false,
      _message: "Email is required",
    });
  }

  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) {
      // For security reasons, don't reveal if the email exists or not
      return res.status(200).json({
        _status: true,
        _message:
          " We have sent you an OTP to your email. Please check your email to reset your password.",
      });
    }

    // Generate OTP and token
    const otp = generateOtp();
    const token = generatePasswordResetToken(email, otp);

    // Send OTP via email
    try {
      await sendEmail(email, "passwordReset", {
        otp,
        subject: "Your Password Reset OTP",
        name: user.name || "User",
      });
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      return res.status(500).json({
        _status: false,
        _message: "Failed to send OTP. Please try again later.",
      });
    }

    return res.status(200).json({
      _status: true,
      _message: "OTP sent to your email",
      _token: token,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

module.exports.verifyOtp = async (req, res) => {
  if (!req.body || !req.body.otp || !req.body.token) {
    return res.status(400).json({
      _status: false,
      _message: "OTP and token are required",
    });
  }

  try {
    const { otp, token } = req.body;

    // Verify the token
    const decoded = verifyPasswordResetToken(token);
    if (!decoded || decoded.type !== "password_reset") {
      return res.status(400).json({
        _status: false,
        _message: "Invalid or expired attempt",
      });
    }

    // Verify OTP
    if (decoded.otp !== otp) {
      return res.status(400).json({
        _status: false,
        _message: "Invalid OTP",
      });
    }

    // Generate a new token for password reset
    const newToken = generatePasswordResetToken(decoded.email, otp);

    return res.status(200).json({
      _status: true,
      _message: "OTP verified successfully",
      _token: newToken, // Send new token for password reset
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

module.exports.resetPassword = async (req, res) => {
  const userEmail = req?.user?.email || req?.body?.email;

  try {
    const { newPassword } = req.body;

    // Find user by email
    const userData = await userModel.findOne({
      email: userEmail,
    });
    if (!userData) {
      return res.status(404).json({
        _status: false,
        _message: "Account Not Found",
      });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user's password
    userData.password = hashedPassword;
    await userData.save();

    return res.status(200).json({
      _status: true,
      _message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

module.exports.verifyUser = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      _status: false,
      _message: "Unauthorized",
    });
  }

  try {
    const user = req.user;
    if (user.isEmailVerified) {
      return res.status(200).json({
        _status: false,
        _message: "You Account is Already Verified",
      });
    }
    const email = user.email;

    // Generate OTP
    const otp = generateOtp();

    // Generate JWT token with OTP and user email
    const verificationToken = jwt.sign(
      {
        email,
        otp,
        type: "email_verification",
        userId: user._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" } // Token expires in 10 minutes
    );

    // Send verification email
    try {
      await sendEmail(email, "verifyEmail", {
        otp,
        subject: "Verify Your Email",
        name: user.name || "User",
        verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&otp=${otp}`,
      });

      return res.status(200).json({
        _status: true,
        _message: "Verification email sent successfully",
        _token: verificationToken, // Send token to client for verification
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return res.status(500).json({
        _status: false,
        _message: "Failed to send verification email. Please try again later.",
      });
    }
  } catch (error) {
    console.error("Verify user error:", error);
    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

module.exports.completeVerify = async (req, res) => {
  const { token, otp } = req.body;

  if (!token || !otp) {
    return res.status(400).json({
      _status: false,
      _message: "Token and OTP are required",
    });
  }

  try {
    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is for email verification
    if (decoded.type !== "email_verification") {
      return res.status(400).json({
        _status: false,
        _message: "Invalid verification token",
      });
    }

    // Verify OTP
    if (decoded.otp !== otp) {
      return res.status(400).json({
        _status: false,
        _message: "Invalid OTP",
      });
    }

    // Find and update user
    const user = await userModel.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        _status: false,
        _message: "User not found",
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    await user.save();

    return res.status(200).json({
      _status: true,
      _message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Complete verify error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(400).json({
        _status: false,
        _message: "Verification link has expired. Please request a new one.",
      });
    }

    return res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { _error: error.message }),
    });
  }
};

const { OAuth2Client } = require("google-auth-library");

module.exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        _status: false,
        _message: "Google credential is required",
      });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture: avatar, sub: googleId } = payload; // Added googleId

    if (!email) {
      return res.status(400).json({
        _status: false,
        _message: "Email not found in Google account",
      });
    }

    // Check if user exists by email OR googleId
    let user = await userModel.findOne({
      $or: [{ email }, { googleId: sub }],
    });

    if (!user) {
      // Create new user if not exists
      user = await userModel.create({
        name,
        email,
        password: await hashPassword(Math.random().toString(36).slice(-8)),
        avatar,
        googleId: sub, // Store Google ID
        isEmailVerified: true,
        status: true,
      });
    } else if (!user.status) {
      return res.status(403).json({
        _status: false,
        _message: "Your account has been deactivated. Please contact support.",
      });
    } else if (!user.googleId) {
      // Link Google account to existing email user
      user.googleId = sub;
      user.isEmailVerified = true;
      if (!user.avatar) user.avatar = avatar;
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user);

    // Omit sensitive data from response
    const { password, ...userData } = user.toObject();

    return res.status(200).json({
      _status: true,
      _message: "Login successful",
      _data: {
        token,
        user: userData,
      },
    });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({
      _status: false,
      _message: "Error during Google authentication",
      _error: error.message,
    });
  }
};

// New endpoint for OAuth2 redirect
module.exports.googleAuthRedirect = async (req, res) => {
  const redirectUri = `${process.env.FRONTEND_URL}/auth/google/callback`;

  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=email profile&` +
    `access_type=offline&` +
    `prompt=select_account`; // Forces account selection

  res.json({ url: googleAuthUrl });
};

// New endpoint to handle the callback
module.exports.googleAuthCallback = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        _status: false,
        _message: "Authorization code is required",
      });
    }

    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.FRONTEND_URL}/auth/google/callback`
    );

    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user info
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture: avatar, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({
        _status: false,
        _message: "Email not found in Google account",
      });
    }

    // Check if user exists
    let user = await userModel.findOne({
      $or: [{ email }, { googleId }],
    });

    if (!user) {
      user = await userModel.create({
        name,
        email,
        password: await hashPassword(Math.random().toString(36).slice(-8)),
        avatar,
        googleId,
        isEmailVerified: true,
        status: true,
      });
    } else if (!user.status) {
      return res.status(403).json({
        _status: false,
        _message: "Your account has been deactivated. Please contact support.",
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.isEmailVerified = true;
      if (!user.avatar) user.avatar = avatar;
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user);

    const { password, ...userData } = user.toObject();

    return res.status(200).json({
      _status: true,
      _message: "Login successful",
      _data: {
        token,
        user: userData,
      },
    });
  } catch (error) {
    console.error("Google auth callback error:", error);
    return res.status(500).json({
      _status: false,
      _message: "Error during Google authentication",
      _error: error.message,
    });
  }
};


//
module.exports.reLogin = async (req, res) => {
  const user = req.user;

  try {
    const token = generateToken(user);

    return res.status(200).json({
      _status: true,
      _message: "Login successful",
      _data: {
        token,
      },
    });
  } catch (error) {
    console.error("Re-login error:", error);
    return res.status(500).json({
      _status: false,
      _message: "Error during re-login",
    });
  }
};
