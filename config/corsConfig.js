const config = require("./envConfig");
const { logSecurityEvent } = require("../services/securityLogService");

const getDefaultOrigins = () => {
    if (config.environment === "production") {
        return [];
    }

    return [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ];
};

function getCorsOptions() {
    const defaultOrigins = getDefaultOrigins();
    const allowedOrigins = [...new Set([...defaultOrigins, ...config.app.corsOrigins])];

    return {
        origin: function (origin, callback) {
            if (allowedOrigins.includes(origin) || !origin) {
                callback(null, true);
            } else {
                const error = new Error("Not allowed by CORS");
                error.status = 403;
                logSecurityEvent(undefined, "CORS_BLOCKED", {
                    status: 403,
                    origin,
                });
                callback(error);
            }
        },
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Request-Id", "X-Recaptcha-Token"],
        maxAge: 86400,
        optionsSuccessStatus: 204,
    };
}

module.exports = getCorsOptions;
