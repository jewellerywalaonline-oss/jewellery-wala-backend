import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "./env.js";

// Initialize S3 client for Cloudflare R2
export const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY ?? "",
  },
  forcePathStyle: true, // Important: Use path-style URLs
});

export const generateSignedUrl = async (
  key: string,
  expiresIn = 3600,
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: env.CLOUDFLARE_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
};

export { GetObjectCommand, PutObjectCommand, DeleteObjectCommand };