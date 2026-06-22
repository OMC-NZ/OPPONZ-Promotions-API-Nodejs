const express = require("express");
const { getCurrentPromotions } = require("../controllers/promotionsController");
const { verifyImei } = require("../controllers/imeiController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { validateRequest } = require("../middlewares/validateRequest");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { required, imei, date, oneOf } = require("../utils/validators");
const { publicReadRateLimiter, writeRateLimiter } = require("../config/securityConfig");

const router = express.Router();

router.route("/current")
    .get(publicReadRateLimiter, getCurrentPromotions)
    .all(methodNotAllowed(["GET"]));

router.route("/verify-imei-purchase")
    .post(
        writeRateLimiter,
        validateRequest({
            body: {
                imei: [required(), imei()],
                purchase_date: [required(), date()],
                recaptcha_token: [required()],
                recaptcha_action: [required(), oneOf(["redeem_search"])],
            },
        }),
        requireRecaptcha({ action: "redeem_search" }),
        verifyImei
    )
    .all(methodNotAllowed(["POST"]));

module.exports = router;
