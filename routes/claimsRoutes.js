const express = require("express");
const { submitClaim } = require("../controllers/claimsController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { validateRequest } = require("../middlewares/validateRequest");
const {
    email,
    fileExtension,
    imei,
    integer,
    maoriEnglishName,
    optional,
    postcode,
    stringLength,
    street,
    titleCaseText,
} = require("../utils/validators");
const { writeRateLimiter } = require("../config/securityConfig");

const router = express.Router();

router.route("/")
    .post(
        writeRateLimiter,
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
