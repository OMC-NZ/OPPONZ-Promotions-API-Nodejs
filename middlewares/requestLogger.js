const { writeLog } = require("../services/logService");

const requestLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        writeLog("request", {
            requestId: req.requestId,
            ip: req.ip,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            userAgent: req.get("user-agent"),
            contentLength: res.get("content-length"),
        });
    });

    next();
};

module.exports = {
    requestLogger,
};
