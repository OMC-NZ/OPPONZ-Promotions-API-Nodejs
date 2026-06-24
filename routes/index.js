const express = require("express");
const fs = require("fs");
const path = require("path");
const promotionsRoutes = require("./promotionsRoutes");
const eventsRoutes = require("./eventsRoutes");
const nzPostRoutes = require("./nzPostRoutes");
const config = require("../config/envConfig");
const {
    defaultRateLimiter,
    recaptchaRateLimiter,
} = require("../config/securityConfig");

const router = express.Router();

const localDiagnosticsRoutesPath = path.resolve(__dirname, "../local-diagnostics/routes.js");

if (config.environment === "development" && fs.existsSync(localDiagnosticsRoutesPath)) {
    // Local-only diagnostics. The local-diagnostics folder is intentionally gitignored.
    router.use("/api/local-tests", recaptchaRateLimiter, require(localDiagnosticsRoutesPath));
}

// Promotions endpoints:
// GET  /api/promotions/current
//   reCAPTCHA: x-recaptcha-token header, action=promotions_current
// POST /api/promotions/verify-imei-purchase
//   reCAPTCHA: body recaptcha_token, body recaptcha_action=redeem_search
router.use("/api/promotions", promotionsRoutes);

// Events endpoints:
// GET /api/events/current
//   reCAPTCHA: x-recaptcha-token header, action=events_current
router.use("/api/events", eventsRoutes);

// NZ Post endpoints:
// GET /api/nzpost/address/search?q=PO%20Box%20194
//   reCAPTCHA: x-recaptcha-token header, action=address_search
// GET /api/nzpost/address/autocomplete?dpid=1104285
//   reCAPTCHA: x-recaptcha-token header, action=address_autocomplete
router.use("/api/nzpost", recaptchaRateLimiter, nzPostRoutes);

router.use(defaultRateLimiter);

module.exports = router;
