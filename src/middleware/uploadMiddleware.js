const multer = require("multer");
const path = require("path");

// Configure multer for memory storage (we'll upload to B2, not disk)
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new Error("Only image files (JPEG, JPG, PNG, WEBP) are allowed!"),
      false
    );
  }
};

// Multer configuration for different use cases
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB - good for high-quality jewelry images
  },
  fileFilter: fileFilter,
});

// Export different upload configurations
module.exports = {
  uploadAvatar: upload.single("avatar"),
  uploadProduct: upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]), 
  uploadSingle: upload.single("image"),
  uploadLogo: upload.single("logo"),
  uploadNone: upload.none(),
};
