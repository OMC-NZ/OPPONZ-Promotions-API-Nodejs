const express = require("express");
const { getCurrentEvents, getEventForm } = require("../controllers/eventsController");
const { verifyImeiChannel } = require("../controllers/imeiController");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { validateRequest } = require("../middlewares/validateRequest");
const { required, imei, stringLength } = require("../utils/validators");
const { publicReadRateLimiter, writeRateLimiter } = require("../config/securityConfig");

const router = express.Router();

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

router.route("/:slug/form")
    .get(
        publicReadRateLimiter,
        requireRecaptcha({ action: "event_form" }),
        getEventForm
    )
    .all(methodNotAllowed(["GET"]));

module.exports = router;
