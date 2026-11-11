const path = require("path");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const config = require("../config/envConfig");
const {
    allowedMimeTypes, allowedExtensions, normalizeClaimType,
    normalizePathSegment, buildClaimObjectKey, validateClaimFile,
} = require("../utils/claimFilePolicy");

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

const buildPublicUrl = (key) => {
    if (!config.r2.publicBaseUrl) return null;
    return `${String(config.r2.publicBaseUrl).replace(/\/+$/, "")}/${key}`;
};

const validateFileForR2 = (file) => {
    validateClaimFile(file, config.r2.uploadMaxBytes);
};

const uploadFileToR2 = async ({ file, claimType = "promotions", slug }) => {
    validateFileForR2(file);

    const key = buildClaimObjectKey({
        claimType,
        slug,
        originalName: file.originalname,
    });

    await getR2Client().send(new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    }), { abortSignal: AbortSignal.timeout(20000) });

    return {
        key,
        url: buildPublicUrl(key),
        file_name: path.basename(key),
        original_name: file.originalname,
        content_type: file.mimetype,
        size: file.size,
        claim_type: normalizeClaimType(claimType),
        slug: normalizePathSegment(slug),
    };
};

module.exports = {
    allowedExtensions,
    allowedMimeTypes,
    validateFileForR2,
    uploadFileToR2,
};
