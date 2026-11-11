const express = require("express");
const { createClaimUpload } = require("../middlewares/claimUpload");
const { getClaimStatus, submitClaim } = require("../controllers/claimsController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { validateRequest } = require("../middlewares/validateRequest");
const {
    email,
    fileExtension,
    giftAliases,
    claimReference,
    imei,
    invoiceNumber,
    integer,
    maoriEnglishName,
    optional,
    postcode,
    required,
    stringLength,
    street,
    titleCaseText,
    recaptchaAction,
} = require("../utils/validators");
const { writeRateLimiter } = require("../config/securityConfig");

const router = express.Router();
const parseClaimFiles = createClaimUpload({
    maxFiles: 2,
    fields: [
        { name: "receipt", maxCount: 1 },
        { name: "screenshot", maxCount: 1 },
    ],
});

router.route("/status")
    .post(
        writeRateLimiter,
        validateRequest({
            body: {
                claim_id: [required(), claimReference(), stringLength({ max: 255 })],
                email: [required(), email(), stringLength({ max: 100 })],
                recaptcha_token: [optional()],
                recaptcha_action: recaptchaAction(["track_claim_search"]),
            },
        }, {
            message: "Claim details could not be verified.",
            code: "CLAIM_STATUS_VALIDATION_ERROR",
            includeRequestId: false,
            includeCode: false,
            includeDebug: false,
        }),
        requireRecaptcha({ action: "track_claim_search" }),
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
                imei: [optional(), imei()],
                purchase_date: [optional()],
                receipt_url: [optional(), fileExtension(), stringLength({ max: 255 })],
                screenshot_url: [optional(), fileExtension(), stringLength({ max: 255 })],
                first_name: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                last_name: [optional(), maoriEnglishName(), stringLength({ max: 45 })],
                email: [optional(), email(), stringLength({ max: 100 })],
                contact: [optional(), stringLength({ max: 45 })],
                street: [optional(), street(), stringLength({ max: 255 })],
                suburb: [optional(), titleCaseText(), stringLength({ max: 255 })],
                city: [optional(), titleCaseText(), stringLength({ max: 255 })],
                postcode: [optional(), postcode()],
                instructions: [optional(), stringLength({ max: 255 })],
                invoicenumber: [required(), invoiceNumber(), stringLength({ max: 100 })],
                gift_alias: [required(), giftAliases()],
                recaptcha_token: [optional()],
                recaptcha_action: recaptchaAction(["claim_submit"]),
            },
        }, {
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
