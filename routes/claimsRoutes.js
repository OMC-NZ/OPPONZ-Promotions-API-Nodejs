const express = require("express");
const { submitClaim } = require("../controllers/claimsController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { validateRequest } = require("../middlewares/validateRequest");
const {
    contact,
    date,
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

router.route("/")
    .post(
        writeRateLimiter,
        validateRequest({
            body: {
                promotion_id: [required(), integer()],
                imei: [required(), imei()],
                purchase_date: [required(), date()],
                receipt_url: [required(), fileExtension(), stringLength({ max: 255 })],
                screenshot_url: [required(), fileExtension(), stringLength({ max: 255 })],
                first_name: [required(), maoriEnglishName(), stringLength({ max: 45 })],
                last_name: [required(), maoriEnglishName(), stringLength({ max: 45 })],
                email: [required(), email(), stringLength({ max: 100 })],
                contact: [required(), contact(), stringLength({ max: 45 })],
                street: [required(), street(), stringLength({ max: 255 })],
                suburb: [required(), titleCaseText(), stringLength({ max: 255 })],
                city: [required(), titleCaseText(), stringLength({ max: 255 })],
                CityTown: [optional(), titleCaseText(), stringLength({ max: 255 })],
                postcode: [required(), postcode()],
                instructions: [optional(), stringLength({ max: 255 })],
                gift_alias: [optional(), stringLength({ max: 45 })],
                giftAlias: [optional(), stringLength({ max: 45 })],
                alias: [optional(), stringLength({ max: 45 })],
            },
        }, {
            message: "Submission failed. Please check your details and submit again.",
            code: "CLAIM_VALIDATION_ERROR",
            includeRequestId: false,
            includeCode: false,
            includeDebug: false,
        }),
        submitClaim
    )
    .all(methodNotAllowed(["POST"]));

module.exports = router;
