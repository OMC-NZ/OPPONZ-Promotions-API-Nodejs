const express = require("express");
const healthRoutes = require("./healthRoutes");
const promotionsRoutes = require("./promotionsRoutes");
const eventsRoutes = require("./eventsRoutes");
const recaptchaRoutes = require("./recaptchaRoutes");
const nzPostRoutes = require("./nzPostRoutes");
const {
    defaultRateLimiter,
    healthRateLimiter,
    recaptchaRateLimiter,
} = require("../config/securityConfig");

const router = express.Router();

router.use("/api/health", healthRateLimiter, healthRoutes);

// Promotions endpoints:
// GET  /api/promotions/current
// POST /api/promotions/verify-imei-purchase
router.use("/api/promotions", promotionsRoutes);

// Events endpoints:
// GET /api/events/current
router.use("/api/events", eventsRoutes);

router.use("/api/recaptcha", recaptchaRateLimiter, recaptchaRoutes);

// NZ Post endpoints:
// GET /api/nzpost/token
// GET /api/nzpost/address/search?q=PO%20Box%20194
// GET /api/nzpost/address/autocomplete?dpid=1104285
router.use("/api/nzpost", recaptchaRateLimiter, nzPostRoutes);

router.use(defaultRateLimiter);

module.exports = router;
