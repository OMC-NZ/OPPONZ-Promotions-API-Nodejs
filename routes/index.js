const express = require("express");
const healthRoutes = require("./healthRoutes");
const promotionsRoutes = require("./promotionsRoutes");
const recaptchaRoutes = require("./recaptchaRoutes");
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

router.use("/api/recaptcha", recaptchaRateLimiter, recaptchaRoutes);
router.use(defaultRateLimiter);

module.exports = router;
