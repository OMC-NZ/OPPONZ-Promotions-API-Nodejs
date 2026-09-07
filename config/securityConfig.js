const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const config = require("./envConfig");
const { logSecurityEvent } = require("../services/securityLogService");
const { sendError } = require("../utils/apiResponse");

const jsonRateLimitHandler = (req, res) => {
    logSecurityEvent(req, "RATE_LIMIT_EXCEEDED", {
        status: 429,
    });

    return sendError(req, res, {
        statusCode: 429,
        message: "You have tried too many times. Please wait a moment and try again.",
        code: "RATE_LIMIT_EXCEEDED",
    });
};

const createRateLimiter = (options) => {
    return rateLimit({
        ...commonRateLimitOptions,
        ...options,
    });
};

const commonRateLimitOptions = {
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler,
};

const getIpRateLimitKey = (req) => {
    return ipKeyGenerator(req.ip || req.socket?.remoteAddress || "");
};

const getEndpointRateLimitKey = (req) => {
    const endpointKey = String(req.originalUrl || req.path || "")
        .split("?")[0]
        .toLowerCase();

    return `${getIpRateLimitKey(req)}:${endpointKey}`;
};

const getRequestIdentifierRateLimitKey = (req) => {
    const identifiers = [
        req.body?.imei,
        req.body?.claim_id,
        req.body?.email,
        req.body?.promotion_id,
        req.params?.slug,
        req.query?.q,
        req.query?.dpid,
    ];
    const identifierKey = identifiers
        .map((value) => String(value || "").trim().toLowerCase())
        .find(Boolean);

    return identifierKey
        ? `${getEndpointRateLimitKey(req)}:${identifierKey}`
        : getEndpointRateLimitKey(req);
};

const defaultRateLimiter = createRateLimiter({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
});

const publicReadRateLimiter = createRateLimiter({
    windowMs: config.rateLimit.publicWindowMs,
    limit: config.rateLimit.publicMax,
    keyGenerator: getEndpointRateLimitKey,
});

const writeRateLimiter = createRateLimiter({
    windowMs: config.rateLimit.writeWindowMs,
    limit: config.rateLimit.writeMax,
    keyGenerator: getRequestIdentifierRateLimitKey,
});

const imeiVerificationRateLimiter = createRateLimiter({
    windowMs: config.rateLimit.imeiVerificationWindowMs,
    limit: config.rateLimit.imeiVerificationMax,
    keyGenerator: getRequestIdentifierRateLimitKey,
});

const recaptchaRateLimiter = createRateLimiter({
    windowMs: config.rateLimit.recaptchaWindowMs,
    limit: config.rateLimit.recaptchaMax,
    keyGenerator: getRequestIdentifierRateLimitKey,
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
    imeiVerificationRateLimiter,
    recaptchaRateLimiter,
    getClientIp,
    getIpDebugInfo,
    enforceHttps,
};
