const { writeLog } = require("../services/logService");
const { getNewZealandTime } = require("../utils/nzTimeZone");
const { redactSensitiveData } = require("../utils/redactSensitiveData");

const requestLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint();

    console.log("[backend request received]", {
        timestamp: getNewZealandTime(),
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
    });

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const responseSummary = res.locals.apiResponseSummary;
        const failed = res.statusCode >= 400;
        const logPayload = {
            requestId: req.requestId,
            ip: req.ip,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            result: failed ? "failed" : "success",
            message: responseSummary?.message,
            code: responseSummary?.code,
            internalMessage: responseSummary?.internalMessage,
            debug: responseSummary?.debug,
            durationMs: Number(durationMs.toFixed(2)),
            userAgent: req.get("user-agent"),
            contentLength: res.get("content-length"),
        };

        console.log("[backend response sent]", {
            timestamp: getNewZealandTime(),
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            result: logPayload.result,
            message: responseSummary?.message,
            code: responseSummary?.code,
            debug: failed ? redactSensitiveData(responseSummary?.debug) : undefined,
            durationMs: Number(durationMs.toFixed(2)),
        });

        writeLog("request", logPayload);

        if (failed) {
            writeLog("error", {
                event: "API_RESPONSE_FAILED",
                ...logPayload,
            });
        }
    });

    next();
};

module.exports = {
    requestLogger,
};
