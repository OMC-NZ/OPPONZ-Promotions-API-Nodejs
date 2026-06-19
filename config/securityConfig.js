const { rateLimit } = require("express-rate-limit");
const config = require("./envConfig");
const { logSecurityEvent } = require("../services/securityLogService");
const { sendError } = require("../utils/apiResponse");

const jsonRateLimitHandler = (req, res) => {
    logSecurityEvent(req, "RATE_LIMIT_EXCEEDED", {
        status: 429,
    });

    return sendError(req, res, {
        statusCode: 429,
        message: "Too many requests. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
    });
};

const commonRateLimitOptions = {
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler,
};

const defaultRateLimiter = rateLimit({
    ...commonRateLimitOptions,
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
});

const publicReadRateLimiter = rateLimit({
    ...commonRateLimitOptions,
    windowMs: config.rateLimit.publicWindowMs,
    limit: config.rateLimit.publicMax,
});

const writeRateLimiter = rateLimit({
    ...commonRateLimitOptions,
    windowMs: config.rateLimit.writeWindowMs,
    limit: config.rateLimit.writeMax,
});

const recaptchaRateLimiter = rateLimit({
    ...commonRateLimitOptions,
    windowMs: config.rateLimit.recaptchaWindowMs,
    limit: config.rateLimit.recaptchaMax,
});

const healthRateLimiter = rateLimit({
    ...commonRateLimitOptions,
    windowMs: config.rateLimit.healthWindowMs,
    limit: config.rateLimit.healthMax,
});

const getClientIp = (req) => {
    return req.ip || req.socket?.remoteAddress || "";
};

const getIpDebugInfo = (req) => ({
    ip: req.ip,
    ips: req.ips,
    remoteAddress: req.socket?.remoteAddress,
    xForwardedFor: req.get("x-forwarded-for"),
    xRealIp: req.get("x-real-ip"),
    cfConnectingIp: req.get("cf-connecting-ip"),
});

const enforceHttps = (req, res, next) => {
    if (!config.app.enforceHttps || req.secure) {
        return next();
    }

    logSecurityEvent(req, "HTTPS_REQUIRED", {
        status: 426,
    });

    return sendError(req, res, {
        statusCode: 426,
        message: "HTTPS is required.",
        code: "HTTPS_REQUIRED",
    });
};

module.exports = {
    defaultRateLimiter,
    publicReadRateLimiter,
    writeRateLimiter,
    recaptchaRateLimiter,
    healthRateLimiter,
    getClientIp,
    getIpDebugInfo,
    enforceHttps,
};
