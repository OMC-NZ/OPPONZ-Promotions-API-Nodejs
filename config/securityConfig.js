const { rateLimit } = require("express-rate-limit");
const config = require("./envConfig");

const jsonRateLimitHandler = (req, res) => {
    return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
    });
};

const commonRateLimitOptions = {
    windowMs: config.rateLimit.windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler,
};

const apiRateLimiter = rateLimit({
    ...commonRateLimitOptions,
    limit: config.rateLimit.max,
});

const recaptchaRateLimiter = rateLimit({
    ...commonRateLimitOptions,
    limit: config.rateLimit.recaptchaMax,
});

const enforceHttps = (req, res, next) => {
    if (!config.app.enforceHttps || req.secure) {
        return next();
    }

    return res.status(426).json({
        success: false,
        message: "HTTPS is required.",
    });
};

module.exports = {
    apiRateLimiter,
    recaptchaRateLimiter,
    enforceHttps,
};
