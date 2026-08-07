import multer from "multer";
import path from "path";
import type { Request } from "express";

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for images only — validates extension and mimetype.
// Magic-byte verification via Sharp is intentionally omitted because:
//   - Sharp validates the format during actual image processing in uploadToR2
//   - This avoids processing every uploaded file through Sharp twice
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (!mimetype || !extname) {
    cb(
      new Error("Only image files (JPEG, JPG, PNG, WEBP) are allowed!"),
    );
    return;
  }

  cb(null, true);
};

// Multer configuration
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file (reduced from 10MB)
    files: 10, // max 10 files total per request
  },
  fileFilter,
});

// Export different upload configurations
export const uploadAvatar = upload.single("avatar");
export const uploadProduct = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 9 }, // reduced from 10 to respect total files limit
  { name: "giftImages", maxCount: 5 },
]);
export const uploadSingle = upload.single("image");
export const uploadLogo = upload.single("logo");
export const uploadNone = upload.none();
