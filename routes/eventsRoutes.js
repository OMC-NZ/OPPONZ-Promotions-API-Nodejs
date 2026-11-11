const express = require("express");
const { createClaimUpload } = require("../middlewares/claimUpload");
const { getCurrentEvents, getEventForm, submitEventClaim } = require("../controllers/eventsController");
const { verifyImeiChannel } = require("../controllers/imeiController");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { validateRequest } = require("../middlewares/validateRequest");
const {
    email,
    imei,
    jsonObject,
    maoriEnglishName,
    optional,
    postcode,
    recaptchaAction,
    required,
    stringLength,
    street,
    titleCaseText,
} = require("../utils/validators");
const { publicReadRateLimiter, writeRateLimiter, imeiVerificationRateLimiter } = require("../config/securityConfig");

const router = express.Router();
const parseEventClaimFiles = createClaimUpload({ maxFiles: 10 });

router.route("/current")
    .get(
        publicReadRateLimiter,
        requireRecaptcha({ action: "events_current" }),
        getCurrentEvents
    )
    .all(methodNotAllowed(["GET"]));

router.route("/verify-imei-channel")
    .post(
        imeiVerificationRateLimiter,
        validateRequest({
            body: {
                imei: [required(), imei()],
                slug_url: [required(), stringLength({ max: 255 })],
                recaptcha_token: [optional()],
                recaptcha_action: recaptchaAction(["event_imei_channel_verify"]),
            },
        }, {
            message: "Please check your IMEI and try again.",
            code: "EVENT_IMEI_VERIFICATION_VALIDATION_ERROR",
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
                last_name: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                email: [optional(), email(), stringLength({ max: 100 })],
                contact: [optional(), stringLength({ max: 45 })],
                street: [optional(), street(), stringLength({ max: 255 })],
                suburb: [optional(), titleCaseText(), stringLength({ max: 255 })],
                city: [optional(), titleCaseText(), stringLength({ max: 255 })],
                postcode: [optional(), postcode()],
                instructions: [optional(), stringLength({ max: 255 })],
                extra_data: [optional(), stringLength({ max: 10000 }), jsonObject()],
                recaptcha_token: [optional()],
                recaptcha_action: recaptchaAction(["event_claim_submit"]),
            },
        }, {
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
