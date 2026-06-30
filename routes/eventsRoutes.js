const express = require("express");
const { getCurrentEvents, getEventForm } = require("../controllers/eventsController");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { publicReadRateLimiter } = require("../config/securityConfig");

const router = express.Router();

router.route("/current")
    .get(
        publicReadRateLimiter,
        requireRecaptcha({ action: "events_current" }),
        getCurrentEvents
    )
    .all(methodNotAllowed(["GET"]));

router.route("/:slug/form")
    .get(
        publicReadRateLimiter,
        requireRecaptcha({ action: "event_form" }),
        getEventForm
    )
    .all(methodNotAllowed(["GET"]));

module.exports = router;
