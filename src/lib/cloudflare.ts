import crypto from "crypto";
import path from "path";
import sharp from "sharp";
import {
  s3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "../config/cloudflare.config.js";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

interface MulterFile {
  buffer: Buffer;
  originalname: string;
}

interface UploadResult {
  success: boolean;
  url: string;
  fileName: string;
}

/**
 * Generate a unique filename with folder structure.
 * If `customName` is provided, it's used as the base name instead of the original filename.
 */
const generateFileName = (
  originalName: string,
  folder = "",
  customName?: string,
): string => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalName).toLowerCase();
  const name = customName
    ? customName.replace(/[^a-z0-9]/gi, "-").toLowerCase()
    : path
        .basename(originalName, ext)
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();
  return `${
    folder ? `${folder}/` : ""
  }${name}-${randomString}-${timestamp}${ext}`;
};

/**
 * Get the R2 public URL base (with trailing slash).
 * Uses CLOUDFLARE_PUBLIC_URL env var when available, otherwise falls back
 * to constructing the URL from the account ID and bucket name.
 */
export const getPublicUrlBase = (): string => {
  if (env.CLOUDFLARE_PUBLIC_URL) {
    return env.CLOUDFLARE_PUBLIC_URL.endsWith("/")
      ? env.CLOUDFLARE_PUBLIC_URL
      : `${env.CLOUDFLARE_PUBLIC_URL}/`;
  }
  return `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.CLOUDFLARE_BUCKET_NAME}/`;
};

/**
 * Build the full public URL for an R2 object key.
 */
const getPublicUrl = (key: string): string => {
  return `${getPublicUrlBase()}${key}`;
};

/**
 * Upload file to Cloudflare R2.
 */
export const uploadToR2 = async (
  file: MulterFile,
  folder = "users",
  quality = 80,
  customName?: string,
): Promise<UploadResult> => {
  try {
    const imageQuality = folder === "banner" ? 85 : quality || 80;

    const pipeline = sharp(file.buffer)
      .resize({
        width: 1200,
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      })
      .webp({ quality: imageQuality, effort: 6 });

    let fileName = generateFileName(file.originalname, folder, customName);
    const contentType = "image/webp";

    fileName = fileName.replace(path.extname(fileName), ".webp");

    const buffer = await pipeline.toBuffer();

    const command = new PutObjectCommand({
      Bucket: env.CLOUDFLARE_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      ACL: "public-read",
    });

    await s3Client.send(command);

    const fileUrl = getPublicUrl(fileName);

    return {
      success: true,
      url: fileUrl,
      fileName,
    };
  } catch (error) {
    logger.error({ err: error }, "R2 Upload Error");
    throw new Error("Failed to upload file to Cloudflare R2");
  }
};

/**
 * Delete file from Cloudflare R2
 */
export const deleteFromR2 = async (
  fileName: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: env.CLOUDFLARE_BUCKET_NAME,
      Key: fileName,
    });

    await s3Client.send(command);

    return {
      success: true,
      message: "File deleted successfully",
    };
  } catch (error) {
    logger.error({ err: error }, "R2 Delete Error");
    throw new Error("Failed to delete file from Cloudflare R2");
  }
};

/**
 * Upload multiple files
 */
export const uploadMultipleToR2 = async (
  files: MulterFile[],
  folder = "products",
  customName?: string,
): Promise<UploadResult[]> => {
  try {
    const uploadPromises = files.map((file) => uploadToR2(file, folder, 80, customName));
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    logger.error({ err: error }, "R2 Multiple Upload Error");
    throw new Error("Failed to upload files to Cloudflare R2");
  }
};