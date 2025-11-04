const { S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // Important: Use path-style URLs
});


const generateSignedUrl = async (key, expiresIn = 3600) => {
  const command = new GetObjectCommand({  
    Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
};

module.exports = {
  s3Client,
  generateSignedUrl,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
};
