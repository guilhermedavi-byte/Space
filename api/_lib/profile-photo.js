const crypto = require("crypto");
const sharp = require("sharp");

const { getGoogleAccessToken } = require("../../_lib/google-service-account");
const { getFirebasePublicConfig } = require("../../_lib/runtime-env");

const STORAGE_SCOPE = "https://www.googleapis.com/auth/devstorage.full_control";
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const OUTPUT_SIZE_PX = 400;
const OUTPUT_MIME = "image/webp";
const OUTPUT_EXTENSION = "webp";
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const safeString = (value) => (value == null ? "" : String(value).trim());

const parseJsonBodyWithLimit = (req, { maxBytes = 8 * 1024 * 1024 } = {}) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        reject(new Error("payload_too_large"));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });

const decodeBase64ImagePayload = (value) => {
  const raw = safeString(value);
  if (!raw) {
    const error = new Error("missing_image_data");
    error.code = "missing_image_data";
    throw error;
  }
  const cleaned = raw.replace(/^data:[^;]+;base64,/, "");
  let buffer;
  try {
    buffer = Buffer.from(cleaned, "base64");
  } catch (error) {
    const nextError = new Error("invalid_image_base64");
    nextError.code = "invalid_image_base64";
    throw nextError;
  }
  if (!buffer.length) {
    const error = new Error("empty_image_payload");
    error.code = "empty_image_payload";
    throw error;
  }
  if (buffer.length > MAX_PROFILE_PHOTO_BYTES) {
    const error = new Error("image_too_large");
    error.code = "image_too_large";
    error.maxBytes = MAX_PROFILE_PHOTO_BYTES;
    throw error;
  }
  return buffer;
};

const detectImageType = async (buffer) => {
  const mod = await import("file-type");
  return mod.fileTypeFromBuffer(buffer);
};

const transformProfilePhotoBuffer = async (inputBuffer) => {
  const fileType = await detectImageType(inputBuffer);
  const mime = safeString(fileType?.mime).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    const error = new Error("unsupported_image_type");
    error.code = "unsupported_image_type";
    error.detectedMime = mime || "";
    throw error;
  }
  const image = sharp(inputBuffer, { failOnError: true });
  const metadata = await image.metadata();
  if (!metadata || !metadata.width || !metadata.height) {
    const error = new Error("invalid_image_dimensions");
    error.code = "invalid_image_dimensions";
    throw error;
  }
  const outputBuffer = await image
    .rotate()
    .resize(OUTPUT_SIZE_PX, OUTPUT_SIZE_PX, {
      fit: "cover",
      position: "attention",
      withoutEnlargement: false,
    })
    .webp({ quality: 86, effort: 4 })
    .toBuffer();
  return {
    sourceMime: mime,
    width: metadata.width,
    height: metadata.height,
    outputBuffer,
    outputMime: OUTPUT_MIME,
    outputExtension: OUTPUT_EXTENSION,
  };
};

const buildFirebaseDownloadUrl = ({ bucket, objectPath, token }) =>
  `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`;

const getStorageBucketName = () => {
  const config = getFirebasePublicConfig(process.env);
  const bucket = safeString(config?.storageBucket);
  if (!bucket) {
    const error = new Error("missing_storage_bucket");
    error.code = "missing_storage_bucket";
    throw error;
  }
  return bucket;
};

const uploadBufferToFirebaseStorage = async ({ objectPath, buffer, contentType, cacheControl = "public,max-age=31536000,immutable" }) => {
  const bucket = getStorageBucketName();
  const access = await getGoogleAccessToken({ scope: STORAGE_SCOPE });
  const accessToken = safeString(access?.accessToken);
  if (!accessToken) {
    const error = new Error("missing_storage_access_token");
    error.code = "missing_storage_access_token";
    throw error;
  }
  const downloadToken = crypto.randomUUID();
  const boundary = `space-photo-${crypto.randomUUID()}`;
  const metadata = {
    name: objectPath,
    contentType,
    cacheControl,
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
    },
  };
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    "utf8"
  );
  const closing = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const body = Buffer.concat([preamble, buffer, closing]);
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=multipart&name=${encodeURIComponent(objectPath)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });
  const text = await res.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const error = new Error("storage_upload_failed");
    error.code = "storage_upload_failed";
    error.status = res.status;
    error.details = data || text || null;
    throw error;
  }
  return {
    bucket,
    objectPath,
    contentType,
    downloadToken,
    url: buildFirebaseDownloadUrl({ bucket, objectPath, token: downloadToken }),
    response: data,
  };
};

module.exports = {
  ALLOWED_MIME_TYPES,
  MAX_PROFILE_PHOTO_BYTES,
  OUTPUT_MIME,
  OUTPUT_SIZE_PX,
  buildFirebaseDownloadUrl,
  decodeBase64ImagePayload,
  parseJsonBodyWithLimit,
  transformProfilePhotoBuffer,
  uploadBufferToFirebaseStorage,
};
