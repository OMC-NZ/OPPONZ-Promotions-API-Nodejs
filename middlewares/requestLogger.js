const { writeLog } = require("../services/logService");
const { getNewZealandTime } = require("../utils/nzTimeZone");

const requestLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint();

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

        console.log("[api request]", {
            timestamp: getNewZealandTime(),
            requestId: logPayload.requestId,
            method: logPayload.method,
            path: logPayload.path,
            statusCode: logPayload.statusCode,
            result: logPayload.result,
            code: logPayload.code,
            durationMs: logPayload.durationMs,
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
