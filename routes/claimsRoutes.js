const express = require("express");
const multer = require("multer");
const { getClaimStatus, submitClaim } = require("../controllers/claimsController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { validateRequest } = require("../middlewares/validateRequest");
const config = require("../config/envConfig");
const {
    email,
    fileExtension,
    imei,
    integer,
    maoriEnglishName,
    optional,
    postcode,
    required,
    stringLength,
    street,
    titleCaseText,
} = require("../utils/validators");
const { writeRateLimiter } = require("../config/securityConfig");

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.r2.uploadMaxBytes,
        files: 2,
    },
});

const parseClaimFiles = (req, res, next) => {
    upload.fields([
        { name: "receipt", maxCount: 1 },
        { name: "receipt_url", maxCount: 1 },
        { name: "receiptUrl", maxCount: 1 },
        { name: "screenshot", maxCount: 1 },
        { name: "screenshot_url", maxCount: 1 },
        { name: "screenshotUrl", maxCount: 1 },
    ])(req, res, (error) => {
        if (!error) return next();

        error.statusCode = 400;
        error.publicMessage = error.code === "LIMIT_FILE_SIZE"
            ? "File is too large."
            : "Invalid file upload.";
        return next(error);
    });
};

router.route("/status")
    .post(
        writeRateLimiter,
        parseClaimFiles,
        validateRequest({
            body: {
                claim_id: [required(), stringLength({ max: 255 })],
                email: [required(), email(), stringLength({ max: 100 })],
            },
        }, {
            allowUnknown: true,
            message: "Claim details could not be verified.",
            code: "CLAIM_STATUS_VALIDATION_ERROR",
            includeRequestId: false,
            includeCode: false,
            includeDebug: false,
        }),
        getClaimStatus
    )
    .all(methodNotAllowed(["POST"]));

router.route("/")
    .post(
        writeRateLimiter,
        parseClaimFiles,
        validateRequest({
            body: {
                promotion_id: [optional(), integer()],
                promotionId: [optional(), integer()],
                imei: [optional(), imei()],
                purchase_date: [optional()],
                purchaseDate: [optional()],
                receipt_url: [optional(), fileExtension(), stringLength({ max: 255 })],
                receiptUrl: [optional(), fileExtension(), stringLength({ max: 255 })],
                screenshot_url: [optional(), fileExtension(), stringLength({ max: 255 })],
                screenshotUrl: [optional(), fileExtension(), stringLength({ max: 255 })],
                first_name: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                firstName: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                last_name: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                lastName: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                email: [optional(), email(), stringLength({ max: 100 })],
                contact: [optional(), stringLength({ max: 45 })],
                street: [optional(), street(), stringLength({ max: 255 })],
                suburb: [optional(), titleCaseText(), stringLength({ max: 255 })],
                city: [optional(), titleCaseText(), stringLength({ max: 255 })],
                CityTown: [optional(), titleCaseText(), stringLength({ max: 255 })],
                postcode: [optional(), postcode()],
                instructions: [optional(), stringLength({ max: 255 })],
                gift_alias: [optional(), stringLength({ max: 45 })],
                giftAlias: [optional(), stringLength({ max: 45 })],
                alias: [optional(), stringLength({ max: 45 })],
                recaptcha_token: [optional()],
                recaptchaToken: [optional()],
                token: [optional()],
                recaptcha_action: [optional()],
                recaptchaAction: [optional()],
                action: [optional()],
            },
        }, {
            allowUnknown: true,
            message: "Submission failed. Please check your details and submit again.",
            code: "CLAIM_VALIDATION_ERROR",
            includeRequestId: false,
            includeCode: false,
            includeDebug: false,
        }),
        requireRecaptcha({ action: "claim_submit" }),
        submitClaim
    )
    .all(methodNotAllowed(["POST"]));

module.exports = router;
