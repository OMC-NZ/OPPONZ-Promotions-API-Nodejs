const crypto = require("crypto");
const path = require("path");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const config = require("../config/envConfig");

const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "application/pdf",
]);

const allowedExtensions = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".heic",
    ".heif",
    ".pdf",
]);

const claimUploadFolders = {
    promotions: "claims/promotions",
    events: "claims/events",
};

let r2Client;

const assertR2Config = () => {
    const missing = [];
    if (!config.r2.endpoint) missing.push("R2_ENDPOINT");
    if (!config.r2.bucket) missing.push("R2_BUCKET");
    if (!config.r2.accessKeyId) missing.push("R2_ACCESS_KEY_ID");
    if (!config.r2.secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");

    if (missing.length > 0) {
        const error = new Error(`R2 configuration is incomplete: ${missing.join(", ")}`);
        error.statusCode = 500;
        throw error;
    }
};

const getR2Client = () => {
    assertR2Config();

    if (!r2Client) {
        r2Client = new S3Client({
            region: "auto",
            endpoint: config.r2.endpoint,
            credentials: {
                accessKeyId: config.r2.accessKeyId,
                secretAccessKey: config.r2.secretAccessKey,
            },
        });
    }

    return r2Client;
};

const normalizeClaimType = (claimType) => {
    const key = String(claimType || "").trim().toLowerCase();
    return claimUploadFolders[key] ? key : "promotions";
};

const normalizeSlugPathSegment = (slug) => {
    const value = String(slug || "").trim().replace(/^\/+|\/+$/g, "");

    if (!value || value.includes("..") || /[\\/]/.test(value)) {
        const error = new Error("R2 upload slug is required.");
        error.statusCode = 500;
        throw error;
    }

    return value;
};

const getSafeExtension = (originalName) => {
    const extension = path.extname(String(originalName || "")).toLowerCase();
    return extension || "";
};

const buildObjectKey = ({ claimType, slug, originalName }) => {
    const folder = claimUploadFolders[normalizeClaimType(claimType)];
    const slugSegment = normalizeSlugPathSegment(slug);
    const extension = getSafeExtension(originalName);

    return `${folder}/${slugSegment}/${crypto.randomUUID()}${extension}`;
};

const buildPublicUrl = (key) => {
    if (!config.r2.publicBaseUrl) return null;
    return `${String(config.r2.publicBaseUrl).replace(/\/+$/, "")}/${key}`;
};

const validateFileForR2 = (file) => {
    if (!file) {
        const error = new Error("No file uploaded.");
        error.statusCode = 400;
        throw error;
    }

    if (!file.buffer || file.size <= 0) {
        const error = new Error("Uploaded file is empty.");
        error.statusCode = 400;
        throw error;
    }

    if (file.size > config.r2.uploadMaxBytes) {
        const error = new Error("File is too large.");
        error.statusCode = 400;
        throw error;
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
        const error = new Error("Unsupported file type.");
        error.statusCode = 400;
        throw error;
    }

    const extension = getSafeExtension(file.originalname);
    if (!allowedExtensions.has(extension)) {
        const error = new Error("Unsupported file extension.");
        error.statusCode = 400;
        throw error;
    }
};

const uploadFileToR2 = async ({ file, claimType = "promotions", slug }) => {
    validateFileForR2(file);

    const key = buildObjectKey({
        claimType,
        slug,
        originalName: file.originalname,
    });

    await getR2Client().send(new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    }));

    return {
        key,
        url: buildPublicUrl(key),
        file_name: path.basename(key),
        original_name: file.originalname,
        content_type: file.mimetype,
        size: file.size,
        claim_type: normalizeClaimType(claimType),
        slug: normalizeSlugPathSegment(slug),
    };
};

module.exports = {
    allowedExtensions,
    allowedMimeTypes,
    validateFileForR2,
    uploadFileToR2,
};
