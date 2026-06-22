const { verifyRecaptchaToken } = require("../services/recaptchaService");
const { logSecurityEvent } = require("../services/securityLogService");
const { sendError } = require("../utils/apiResponse");

const getTokenFromRequest = (req) => {
    return String(
        req.body?.recaptcha_token ||
        req.body?.recaptchaToken ||
        req.body?.token ||
        req.get("x-recaptcha-token") ||
        ""
    ).trim();
};

const requireRecaptcha = (options = {}) => {
    return async (req, res, next) => {
        const token = getTokenFromRequest(req);
        const expectedAction = options.action || req.body?.recaptcha_action || req.body?.action;

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
