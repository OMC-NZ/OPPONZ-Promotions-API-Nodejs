const config = require("../config/envConfig");
const { uploadFileToOneDrive } = require("./oneDriveUploadService");
const { uploadFileToR2, validateFileForR2 } = require("./r2UploadService");

const getClaimUploadProvider = () => {
    return config.environment === "development" ? "onedrive" : "r2";
};

const uploadClaimFile = async ({ file, claimType = "promotions", slug }) => {
    const provider = getClaimUploadProvider();
    const upload = provider === "onedrive"
        ? await uploadFileToOneDrive({ file, claimType, slug })
        : await uploadFileToR2({ file, claimType, slug });

    return {
        ...upload,
        provider,
    };
};

module.exports = {
    getClaimUploadProvider,
    uploadClaimFile,
    validateClaimFile: validateFileForR2,
};
