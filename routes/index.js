const express = require("express");
const healthRoutes = require("./healthRoutes");
const promotionsRoutes = require("./promotionsRoutes");
const recaptchaRoutes = require("./recaptchaRoutes");

const router = express.Router();

router.use("/api/health", healthRoutes);
router.use("/api/promotions", promotionsRoutes);
router.use("/api/recaptcha", recaptchaRoutes);

module.exports = router;
