const crypto = require("crypto");
const path = require("path");
const sharp = require("sharp");
const {
  s3Client,
  generateSignedUrl,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("../config/cloudflare.config");
const { configDotenv } = require("dotenv");
configDotenv();

/**
 * Generate a unique filename with folder structure
 */
const generateFileName = (originalName, folder = "") => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalName).toLowerCase();
  const name = path
    .basename(originalName, ext)
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();
  return `${
    folder ? `${folder}/` : ""
  }${name}-${randomString}-${timestamp}${ext}`;
};

/**
 * Optimize image using Sharp
 */
const optimizeImage = async (buffer, options ) => {
  return await sharp(buffer)
    .resize({
      width: 1200,
      fit: sharp.fit.inside,
      withoutEnlargement: true,
    })
    .toFormat("webp", {
      quality: options.quality || 90,
      effort: 6,
    })
    .toBuffer();
};

/**
 * Upload file to Cloudflare R2
 */
const uploadToR2 = async (file, folder = "users") => {
  try {
    // Generate unique filename
    let fileBuffer;
    if (file.size < 1024 * 1024 * 0.5) {
      fileBuffer = await optimizeImage(file.buffer, { quality: 100 });
    } else {
      fileBuffer = await optimizeImage(file.buffer, { quality: 90 });
    }
    let fileName = generateFileName(file.originalname, folder);
    let contentType = "image/webp";

    fileName = fileName.replace(path.extname(fileName), ".webp");
    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: "public-read",
    });

    await s3Client.send(command);

    // Generate public URL (if public access is enabled) // slash is in env
    const fileUrl = `${process.env.CLOUDFLARE_PUBLIC_URL}${fileName}`;

    return {
      success: true,
      url: fileUrl,
      fileName,
    };
  } catch (error) {
    console.error("R2 Upload Error:", error);
    throw new Error("Failed to upload file to Cloudflare R2");
  }
};

/**
 * Delete file from Cloudflare R2
 */
const deleteFromR2 = async (fileName) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: fileName,
    });

    await s3Client.send(command);

    return {
      success: true,
      message: "File deleted successfully",
    };
  } catch (error) {
    console.error("R2 Delete Error:", error);
    throw new Error("Failed to delete file from Cloudflare R2");
  }
};

/**
 * Upload multiple files
 */
const uploadMultipleToR2 = async (files, folder = "products") => {
  try {
    const uploadPromises = files.map((file) => uploadToR2(file, folder));
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error("R2 Multiple Upload Error:", error);
    throw new Error("Failed to upload files to Cloudflare R2");
  }
};

module.exports = {
  uploadToR2,
  deleteFromR2,
  uploadMultipleToR2,
  optimizeImage,
};
