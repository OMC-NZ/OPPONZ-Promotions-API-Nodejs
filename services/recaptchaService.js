const { requestJson } = require("../utils/httpJson");
const config = require("../config/envConfig");

const SITEVERIFY_HOSTNAME = "www.google.com";
const SITEVERIFY_PATH = "/recaptcha/api/siteverify";

const postSiteVerify = (token) => {
    const body = new URLSearchParams({
        secret: config.recaptcha.secretKey,
        response: token,
    }).toString();

    return requestJson({
        url: `https://${SITEVERIFY_HOSTNAME}${SITEVERIFY_PATH}`,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        label: "Google siteverify",
        maxResponseBytes: 64 * 1024,
    });
};

const verifyRecaptchaToken = async ({ token, expectedAction }) => {
    if (!token) {
        return {
            verified: false,
            status: 400,
            message: "Token is required.",
        };
    }

    if (!config.recaptcha.secretKey) {
        console.error("RECAPTCHA_SECRET_KEY_V3 is not configured.");
        return {
            verified: false,
            status: 500,
            message: "reCAPTCHA is not configured.",
        };
    }

    const result = await postSiteVerify(token);
    const googleSuccess = result.success === true;
    const scorePresent = Number.isFinite(result.score) && result.score >= 0 && result.score <= 1;
    const score = scorePresent ? result.score : 0;
    const scoreAccepted = scorePresent && score >= config.recaptcha.minScore;
    const actionMatches = !expectedAction || result.action === expectedAction;
    const verified = googleSuccess && scoreAccepted && actionMatches;
    let failureReason;

    if (!googleSuccess) {
        failureReason = "GOOGLE_REJECTED_TOKEN";
    } else if (!scorePresent) {
        failureReason = "RECAPTCHA_SCORE_MISSING";
    } else if (!scoreAccepted) {
        failureReason = "RECAPTCHA_SCORE_TOO_LOW";
    } else if (!actionMatches) {
        failureReason = "RECAPTCHA_ACTION_MISMATCH";
    }

    return {
        verified,
        status: verified ? 200 : 403,
        message: verified ? "reCAPTCHA verified." : "reCAPTCHA verification failed.",
        score: result.score,
        action: result.action,
        errors: result["error-codes"],
        expectedAction,
        googleSuccess,
        scoreAccepted,
        actionMatches,
        failureReason,
    };
};

module.exports = {
    verifyRecaptchaToken,
};
