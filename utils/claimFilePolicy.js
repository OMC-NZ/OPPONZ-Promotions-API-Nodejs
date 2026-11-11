const { randomUUID } = require("crypto");
const path = require("path");
const { normalizeText } = require("./text");

const mimeByExtension = new Map([
    [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
    [".png", "image/png"], [".pdf", "application/pdf"],
]);
const allowedExtensions = new Set(mimeByExtension.keys());
const allowedMimeTypes = new Set(mimeByExtension.values());
const claimUploadFolders = { promotions: "claims/promotions", events: "claims/events" };

const uploadError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const getSafeExtension = (name) => path.extname(normalizeText(name)).toLowerCase();

const normalizeClaimType = (claimType) => {
    const key = normalizeText(claimType).toLowerCase();
    if (!Object.hasOwn(claimUploadFolders, key)) throw uploadError("Invalid claim upload type.", 500);
    return key;
};

const normalizePathSegment = (value) => {
    const text = normalizeText(value).replace(/^\/+|\/+$/g, "");
    if (!text || text.includes("..") || /[\\/\x00-\x1f\x7f?#:]/.test(text)) {
        throw uploadError("Claim upload folder is invalid.", 500);
    }
    return text;
};

const buildClaimObjectKey = ({ claimType = "promotions", slug, originalName }) => {
    return `${claimUploadFolders[normalizeClaimType(claimType)]}/${normalizePathSegment(slug)}/${randomUUID()}${getSafeExtension(originalName)}`;
};

const validateFileMetadata = (file) => {
    if (!file) throw uploadError("No file uploaded.");
    if (mimeByExtension.get(getSafeExtension(file.originalname)) !== file.mimetype) {
        throw uploadError("Unsupported file type or mismatched file extension.");
    }
};

const validateClaimFile = (file, maxBytes) => {
    validateFileMetadata(file);
    if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0 || file.size <= 0) {
        throw uploadError("Uploaded file is empty.");
    }
    if (file.size !== file.buffer.length) throw uploadError("Invalid file size.");
    if (file.size > maxBytes) throw uploadError("File is too large.");

    const bytes = file.buffer;
    const matches = file.mimetype === "image/jpeg"
        ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : file.mimetype === "image/png"
            ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
            : bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"));
    if (!matches) throw uploadError("File contents do not match the declared type.");
};

module.exports = {
    allowedExtensions, allowedMimeTypes, claimUploadFolders, normalizeClaimType,
    normalizePathSegment, buildClaimObjectKey, validateFileMetadata, validateClaimFile,
};
