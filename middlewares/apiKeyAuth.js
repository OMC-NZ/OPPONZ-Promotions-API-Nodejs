const crypto = require("crypto");
const config = require("../config/envConfig");
const { logSecurityEvent } = require("../services/securityLogService");
const { sendError } = require("../utils/apiResponse");

const API_KEY_HEADER = "x-api-key";

const timingSafeEquals = (left, right) => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const isValidApiKey = (candidate) => {
    if (!candidate || config.common.internalApiKeys.length === 0) {
        return false;
    }

    return config.common.internalApiKeys.some((apiKey) => timingSafeEquals(candidate, apiKey));
};

const logApiKeyFailure = (req, status, message) => {
    logSecurityEvent(req, "API_KEY_AUTH_FAILED", {
        status,
        message,
    });
};

const requireApiKey = (req, res, next) => {
    if (config.common.internalApiKeys.length === 0) {
        const message = "Internal API keys are not configured.";
        logApiKeyFailure(req, 500, message);

        return sendError(req, res, {
            statusCode: 500,
            message: "Internal authentication is not configured.",
            code: "API_KEY_NOT_CONFIGURED",
        });
    }

    const candidate = String(req.get(API_KEY_HEADER) || "").trim();

    if (!candidate) {
        const message = "Missing internal API key.";
        logApiKeyFailure(req, 401, message);

        return sendError(req, res, {
            statusCode: 401,
            message: "Unauthorized.",
            code: "API_KEY_MISSING",
        });
    }

    if (!isValidApiKey(candidate)) {
        const message = "Invalid internal API key.";
        logApiKeyFailure(req, 403, message);

        return sendError(req, res, {
            statusCode: 403,
            message: "Forbidden.",
            code: "API_KEY_INVALID",
        });
    }

    return next();
};

module.exports = {
    requireApiKey,
};
