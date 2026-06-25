const express = require("express");
const { submitClaim } = require("../controllers/claimsController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { validateRequest } = require("../middlewares/validateRequest");
const {
    contact,
    date,
    email,
    imei,
    integer,
    optional,
    postcode,
    required,
    stringLength,
    street,
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
                receipt_url: [required(), stringLength({ max: 255 })],
                screenshot_url: [required(), stringLength({ max: 255 })],
                first_name: [required(), stringLength({ max: 45 })],
                last_name: [required(), stringLength({ max: 45 })],
                email: [required(), email(), stringLength({ max: 100 })],
                contact: [required(), contact(), stringLength({ max: 45 })],
                street: [required(), street(), stringLength({ max: 255 })],
                suburb: [required(), stringLength({ max: 255 })],
                city: [required(), stringLength({ max: 255 })],
                CityTown: [optional(), stringLength({ max: 255 })],
                postcode: [required(), postcode()],
                instructions: [optional(), stringLength({ max: 255 })],
                gift_alias: [optional(), stringLength({ max: 45 })],
                giftAlias: [optional(), stringLength({ max: 45 })],
                alias: [optional(), stringLength({ max: 45 })],
            },
        }),
        submitClaim
    )
    .all(methodNotAllowed(["POST"]));

module.exports = router;
