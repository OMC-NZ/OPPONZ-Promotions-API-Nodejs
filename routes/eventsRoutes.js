const express = require("express");
const { getCurrentEvents } = require("../controllers/eventsController");
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

module.exports = router;
