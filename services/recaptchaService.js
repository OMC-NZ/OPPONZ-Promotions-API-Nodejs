const https = require("https");
const config = require("../config/envConfig");

const SITEVERIFY_HOSTNAME = "www.google.com";
const SITEVERIFY_PATH = "/recaptcha/api/siteverify";

const postSiteVerify = (token) => {
    const body = new URLSearchParams({
        secret: config.recaptcha.secretKey,
        response: token,
    }).toString();

    const options = {
        hostname: SITEVERIFY_HOSTNAME,
        path: SITEVERIFY_PATH,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(body),
        },
        timeout: 10000,
    };

    return new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
            let responseBody = "";

            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                responseBody += chunk;
            });
            response.on("end", () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    const error = new Error(`Google siteverify returned HTTP ${response.statusCode}`);
                    error.statusCode = response.statusCode;
                    reject(error);
                    return;
                }

                try {
                    resolve(JSON.parse(responseBody));
                } catch (error) {
                    reject(new Error("Invalid JSON returned by Google siteverify."));
                }
            });
        });

        request.on("timeout", () => {
            request.destroy(new Error("Google siteverify request timed out."));
        });
        request.on("error", reject);
        request.write(body);
        request.end();
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
        console.error("RECAPTCHA_SECRET_KEY is not configured.");
        return {
            verified: false,
            status: 500,
            message: "reCAPTCHA is not configured.",
        };
    }

    const result = await postSiteVerify(token);
    const score = typeof result.score === "number" ? result.score : 0;
    const actionMatches = !expectedAction || result.action === expectedAction;
    const verified = result.success === true && score >= config.recaptcha.minScore && actionMatches;

    return {
        verified,
        status: verified ? 200 : 403,
        message: verified ? "reCAPTCHA verified." : "reCAPTCHA verification failed.",
        score: result.score,
        action: result.action,
        errors: result["error-codes"],
    };
};

module.exports = {
    verifyRecaptchaToken,
};
