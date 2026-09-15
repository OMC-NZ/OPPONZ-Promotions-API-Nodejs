const { isRecaptchaEnabled, isStrictProductionSecurity } = require("../config/securityFeatureConfig");
const { verifyRecaptchaToken } = require("../services/recaptchaService");
const { logSecurityEvent } = require("../services/securityLogService");
const { sendError } = require("../utils/apiResponse");

const toRequestText = (value) => {
    if (value === undefined || value === null) return "";

    const valueType = typeof value;
    if (valueType === "string" || valueType === "number" || valueType === "boolean" || valueType === "bigint") {
        return String(value).trim();
    }

    return null;
};

const getFirstRequestText = (...values) => {
    for (const value of values) {
        if (value === undefined || value === null || value === "") continue;

        return toRequestText(value);
    }

    return "";
};

const getTokenFromRequest = (req) => {
    return getFirstRequestText(
        req.body?.recaptcha_token,
        req.get("x-recaptcha-token")
    );
};

const getActionFromRequest = (req) => {
    return getFirstRequestText(
        req.body?.recaptcha_action,
        req.query?.recaptcha_action,
        req.get("x-recaptcha-action")
    );
};

const requireRecaptcha = (options = {}) => {
    return async (req, res, next) => {
        const strictProduction = isStrictProductionSecurity();
        const configuredAction = options.action;
        const requestAction = getActionFromRequest(req);

        if (requestAction === null) {
            return sendError(req, res, {
                statusCode: 400,
                message: "reCAPTCHA action is invalid.",
                code: "RECAPTCHA_ACTION_INVALID",
            });
        }

        if (!isRecaptchaEnabled()) {
            req.recaptcha = {
                verified: true,
                bypassed: true,
                expectedAction: strictProduction ? configuredAction : undefined,
            };
            return next();
        }

        const token = getTokenFromRequest(req);
        const expectedAction = strictProduction ? configuredAction : undefined;

        if (token === null) {
            return sendError(req, res, {
                statusCode: 400,
                message: "reCAPTCHA token is invalid.",
                code: "RECAPTCHA_TOKEN_INVALID",
            });
        }

        if (strictProduction && configuredAction && !requestAction) {
            return sendError(req, res, {
                statusCode: 400,
                message: "reCAPTCHA action is required.",
                code: "RECAPTCHA_ACTION_REQUIRED",
            });
        }

        if (strictProduction && configuredAction && requestAction !== configuredAction) {
            return sendError(req, res, {
                statusCode: 400,
                message: "reCAPTCHA action is invalid.",
                code: "RECAPTCHA_ACTION_INVALID",
            });
        }

        try {
            const verification = await verifyRecaptchaToken({
                token,
                expectedAction,
            });

            if (!verification.verified) {
                logSecurityEvent(req, "RECAPTCHA_FAILED", {
                    status: verification.status,
                    message: verification.message,
                    score: verification.score,
                    action: verification.action,
                    errors: verification.errors,
                    failureReason: verification.failureReason,
                });

                return sendError(req, res, {
                    statusCode: verification.status,
                    message: verification.message,
                    code: "RECAPTCHA_FAILED",
                    debug: {
                        score: verification.score,
                        action: verification.action,
                        errors: verification.errors,
                        expectedAction: verification.expectedAction,
                        googleSuccess: verification.googleSuccess,
                        scoreAccepted: verification.scoreAccepted,
                        actionMatches: verification.actionMatches,
                        failureReason: verification.failureReason,
                    },
                });
            }

            req.recaptcha = verification;
            return next();
        } catch (error) {
            console.error("Error verifying reCAPTCHA:", error);
            logSecurityEvent(req, "RECAPTCHA_VERIFY_ERROR", {
                status: 502,
                message: error.message,
            });

            return sendError(req, res, {
                statusCode: 502,
                message: "Failed to verify reCAPTCHA.",
                code: "RECAPTCHA_VERIFY_ERROR",
                debug: {
                    message: error.message,
                },
            });
        }
    };
};

module.exports = {
    requireRecaptcha,
};
