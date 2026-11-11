const { getTransporter } = require("./mailService");
const { ExpiringCache } = require("../utils/expiringCache");
const config = require("../config/envConfig");
const { getErrorLocation } = require("../utils/errorDetails");
const { redactSensitiveData, redactError } = require("../utils/redactSensitiveData");

const sentAtByFingerprint = new ExpiringCache();

const isProduction = config.environment === "production";

const isConfigured = () => Boolean(
    config.email.host &&
    config.email.port &&
    config.email.user &&
    config.email.pass &&
    config.email.adminEmail
);

const getErrorFingerprint = ({ error, status, req }) => {
    const method = req?.method || "PROCESS";
    const path = req?.route?.path || (req?.originalUrl || req?.url || "process").split("?")[0];
    const message = error?.message || "Unknown error";
    return `${status}:${method}:${path}:${message}`;
};

const shouldSendAlert = ({ status }) => {
    return isProduction && status >= 500 && isConfigured();
};

const buildEmailBody = ({ error, status, req, requestId }) => {
    const location = getErrorLocation(error);
    const safeError = redactError(error);
    const safePath = redactSensitiveData(req?.originalUrl || req?.url || "N/A", "path");
    const safeUserAgent = redactSensitiveData(req?.get ? req.get("user-agent") || "N/A" : "N/A", "userAgent");
    const lines = [
        "A production API error occurred.",
        "",
        `Request ID: ${requestId || "N/A"}`,
        `Status: ${status}`,
        `Environment: ${config.environment}`,
        `Method: ${req?.method || "N/A"}`,
        `Path: ${safePath}`,
        `IP: ${req?.ip || "N/A"}`,
        `User-Agent: ${safeUserAgent}`,
        "",
        `Message: ${safeError?.message || "Unknown error"}`,
        `Location: ${location}`,
        "",
        "Stack:",
        safeError?.stack || "N/A",
    ];

    if (safeError?.details) {
        lines.push("", "Details:", JSON.stringify(safeError.details, null, 2));
    }

    return lines.join("\n");
};

const alertError = async ({ error, status = 500, req, requestId }) => {
    if (!shouldSendAlert({ status })) {
        return false;
    }

    const fingerprint = getErrorFingerprint({ error, status, req });
    const now = Date.now();
    const lastSentAt = sentAtByFingerprint.get(fingerprint) || 0;

    if (now - lastSentAt < config.email.alertCooldownMs) {
        return false;
    }

    sentAtByFingerprint.set(fingerprint, now, config.email.alertCooldownMs);

    try {
        await getTransporter().sendMail({
            from: config.email.user,
            to: config.email.adminEmail,
            subject: `[OPPO Promotions API] ${status} error${requestId ? ` - ${requestId}` : ""} - ${getErrorLocation(error)}`,
            text: buildEmailBody({ error, status, req, requestId }),
        });
        return true;
    } catch (alertError) {
        console.error("Failed to send error alert email:", alertError.message);
        return false;
    }
};

module.exports = {
    alertError,
};
