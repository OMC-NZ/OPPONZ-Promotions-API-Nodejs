const express = require("express");
const multer = require("multer");
const { getCurrentEvents, getEventForm, submitEventClaim } = require("../controllers/eventsController");
const { verifyImeiChannel } = require("../controllers/imeiController");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { validateRequest } = require("../middlewares/validateRequest");
const config = require("../config/envConfig");
const {
    email,
    imei,
    maoriEnglishName,
    optional,
    required,
    stringLength,
} = require("../utils/validators");
const { publicReadRateLimiter, writeRateLimiter } = require("../config/securityConfig");

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.r2.uploadMaxBytes,
        files: 10,
    },
});

const parseEventClaimFiles = (req, res, next) => {
    upload.any()(req, res, (error) => {
        if (!error) return next();

        error.statusCode = 400;
        error.publicMessage = error.code === "LIMIT_FILE_SIZE"
            ? "File is too large."
            : "Invalid file upload.";
        return next(error);
    });
};

router.route("/current")
    .get(
        publicReadRateLimiter,
        requireRecaptcha({ action: "events_current" }),
        getCurrentEvents
    )
    .all(methodNotAllowed(["GET"]));

router.route("/verify-imei-channel")
    .post(
        writeRateLimiter,
        validateRequest({
            body: {
                imei: [required(), imei()],
                slug_url: [required(), stringLength({ max: 255 })],
            },
        }, {
            allowUnknown: true,
        }),
        requireRecaptcha({ action: "event_imei_channel_verify" }),
        verifyImeiChannel
    )
    .all(methodNotAllowed(["POST"]));

router.route("/:slug/claims")
    .post(
        writeRateLimiter,
        parseEventClaimFiles,
        validateRequest({
            params: {
                slug: [required(), stringLength({ max: 255 })],
            },
            body: {
                imei: [optional(), imei()],
                first_name: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                firstName: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                last_name: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                lastName: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                email: [optional(), email(), stringLength({ max: 100 })],
                contact: [optional(), stringLength({ max: 45 })],
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
            code: "EVENT_CLAIM_VALIDATION_ERROR",
            includeRequestId: false,
            includeCode: false,
            includeDebug: false,
        }),
        requireRecaptcha({ action: "event_claim_submit" }),
        submitEventClaim
    )
    .all(methodNotAllowed(["POST"]));

router.route("/:slug/form")
    .get(
        publicReadRateLimiter,
        requireRecaptcha({ action: "event_form" }),
        getEventForm
    )
    .all(methodNotAllowed(["GET"]));

module.exports = router;
