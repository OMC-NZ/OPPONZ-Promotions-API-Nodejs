const { writeLog } = require("./logService");

const logSecurityEvent = (req, event, details = {}) => {
    writeLog("security", {
        requestId: req?.requestId,
        event,
        ip: req?.ip,
        method: req?.method,
        path: req?.originalUrl || req?.url,
        status: details.status,
        userAgent: req?.get ? req.get("user-agent") : undefined,
        ...details,
    });
};

module.exports = {
    logSecurityEvent,
};
