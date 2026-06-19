const express = require("express");
const healthRoutes = require("./healthRoutes");
const promotionsRoutes = require("./promotionsRoutes");
const recaptchaRoutes = require("./recaptchaRoutes");
const {
    defaultRateLimiter,
    healthRateLimiter,
    publicReadRateLimiter,
    recaptchaRateLimiter,
} = require("../config/securityConfig");

const router = express.Router();

router.use("/api/health", healthRateLimiter, healthRoutes);
router.use("/api/promotions", publicReadRateLimiter, promotionsRoutes);
router.use("/api/recaptcha", recaptchaRateLimiter, recaptchaRoutes);
router.use(defaultRateLimiter);

module.exports = router;
