const express = require("express");
const { getCurrentPromotions } = require("../controllers/promotionsController");
const { verifyImei } = require("../controllers/imeiController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { validateRequest } = require("../middlewares/validateRequest");
const { required, imei, date } = require("../utils/validators");
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
            },
        }),
        verifyImei
    )
    .all(methodNotAllowed(["POST"]));

module.exports = router;
