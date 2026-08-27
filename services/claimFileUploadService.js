const config = require("../config/envConfig");
const { uploadFileToOneDrive } = require("./oneDriveUploadService");
const { uploadFileToR2, validateFileForR2 } = require("./r2UploadService");

const getClaimUploadProvider = () => {
    return config.environment === "development" ? "onedrive" : "r2";
};

const claimStorageFolders = {
    promotions: "claims/promotions",
    events: "claims/events",
};

const normalizeClaimType = (claimType) => {
    const key = String(claimType || "").trim().toLowerCase();
    return claimStorageFolders[key] ? key : "promotions";
};

const getRelativeClaimFileKey = ({ key, claimType }) => {
    const normalizedKey = String(key || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const folder = claimStorageFolders[normalizeClaimType(claimType)];
    const marker = `${folder}/`;
    const markerIndex = normalizedKey.indexOf(marker);

    return markerIndex === -1
        ? normalizedKey
        : normalizedKey.slice(markerIndex + marker.length);
};

const uploadClaimFile = async ({ file, claimType = "promotions", slug }) => {
    const provider = getClaimUploadProvider();
    const upload = provider === "onedrive"
        ? await uploadFileToOneDrive({ file, claimType, slug })
        : await uploadFileToR2({ file, claimType, slug });

    return {
        ...upload,
        relative_key: getRelativeClaimFileKey({
            key: upload.key,
            claimType,
        }),
        provider,
    };
};

module.exports = {
    getClaimUploadProvider,
    getRelativeClaimFileKey,
    uploadClaimFile,
    validateClaimFile: validateFileForR2,
};
