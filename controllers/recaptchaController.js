const { verifyRecaptchaToken } = require("../services/recaptchaService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const verifyRecaptcha = async (req, res) => {
    const token = String(req.body?.token || req.body?.recaptchaToken || "").trim();
    const expectedAction = req.body?.action ? String(req.body.action).trim() : undefined;

    try {
        const verification = await verifyRecaptchaToken({
            token,
            expectedAction,
        });

        if (!verification.verified) {
            return sendError(req, res, {
                statusCode: verification.status,
                message: verification.message,
                code: "RECAPTCHA_FAILED",
                debug: {
                    score: verification.score,
                    action: verification.action,
                },
            });
        }

        return sendSuccess(req, res, {
            data: {
                score: verification.score,
                action: verification.action,
            },
        });
    } catch (error) {
        console.error("Error verifying reCAPTCHA:", error);
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

module.exports = {
    verifyRecaptcha,
};
