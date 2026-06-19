const config = require("../config/envConfig");
const { getDatabase } = require("../config/dbConfig");
const { getIpDebugInfo } = require("../config/securityConfig");
const { getNewZealandTimestamp } = require("../utils/nzTimeZone");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const getHealth = async (req, res) => {
    res.set("Cache-Control", "no-store");

    try {
        const { sequelize, activeDatabaseLabel } = getDatabase();
        await sequelize.authenticate();

        return sendSuccess(req, res, {
            data: {
                status: "ok",
                timestamp: getNewZealandTimestamp(),
                timezone: "Pacific/Auckland",
                uptimeSeconds: Math.floor(process.uptime()),
                environment: config.environment,
                database: {
                    status: "up",
                    target: activeDatabaseLabel.toLowerCase(),
                },
            },
        });
    } catch (error) {
        console.error("Health check failed:", error.message);
        return sendError(req, res, {
            statusCode: 503,
            message: "Service Unavailable",
            code: "HEALTH_CHECK_FAILED",
            debug: {
                status: "unavailable",
                timestamp: getNewZealandTimestamp(),
                timezone: "Pacific/Auckland",
                database: {
                    status: "down",
                },
                message: error.message,
            },
        });
    }
};

const getIpDebug = (req, res) => {
    if (!config.app.ipDebug) {
        return sendError(req, res, {
            statusCode: 404,
            message: "Route not found.",
            code: "ROUTE_NOT_FOUND",
        });
    }

    res.set("Cache-Control", "no-store");
    return sendSuccess(req, res, {
        data: {
            trustProxy: config.app.trustProxy,
            client: getIpDebugInfo(req),
        },
    });
};

module.exports = {
    getHealth,
    getIpDebug,
};
