const express = require("express");
const { getCurrentEvents } = require("../controllers/eventsController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { publicReadRateLimiter } = require("../config/securityConfig");

const router = express.Router();

router.route("/current")
    .get(publicReadRateLimiter, getCurrentEvents)
    .all(methodNotAllowed(["GET"]));

module.exports = router;
