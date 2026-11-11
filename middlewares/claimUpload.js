const multer = require("multer");
const config = require("../config/envConfig");
const { validateFileMetadata } = require("../utils/claimFilePolicy");

const createClaimUpload = ({ maxFiles, fields }) => {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: config.r2.uploadMaxBytes,
            files: maxFiles,
            fields: 40,
            parts: 40 + maxFiles,
            fieldSize: 16 * 1024,
            fieldNameSize: 100,
        },
        fileFilter: (req, file, callback) => {
            try {
                validateFileMetadata(file);
                callback(null, true);
            } catch (error) {
                callback(error);
            }
        },
    });
    const middleware = fields ? upload.fields(fields) : upload.any();

    return (req, res, next) => middleware(req, res, (error) => {
        if (!error) return next();
        error.statusCode = 400;
        error.publicMessage = error.code === "LIMIT_FILE_SIZE" ? "File is too large." : "Invalid file upload.";
        return next(error);
    });
};

module.exports = { createClaimUpload };
