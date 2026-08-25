const { alertError } = require("../services/errorAlertService");
const { writeLog } = require("../services/logService");
const { getErrorLocation } = require("../utils/errorDetails");
const { sendError } = require("../utils/apiResponse");
const { redactSensitiveData } = require("../utils/redactSensitiveData");
const { getRequestLogContext } = require("../utils/requestLogContext");
const { logRouteNotFound } = require("./routeSecurity");

const notFoundHandler = (req, res) => {
    logRouteNotFound(req);

    return sendError(req, res, {
        statusCode: 404,
        message: "Route not found.",
        code: "ROUTE_NOT_FOUND",
    });
};

const errorHandler = (error, req, res, next) => {
    const status = error.status || error.statusCode || 500;
    const location = getErrorLocation(error);
    const requestLogContext = getRequestLogContext(req);

    console.error("Request error:", redactSensitiveData({
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        status,
        message: error.message,
        location,
        stack: error.stack,
        details: error.details,
        ...requestLogContext,
    }));

    writeLog("error", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        status,
        message: error.message,
        location,
        stack: error.stack,
        details: error.details,
        ...requestLogContext,
    });

    alertError({
        error,
        status,
        req,
        requestId: req.requestId,
    }).catch((alertError) => {
        console.error("Error alert failed:", alertError.message);
    });

    return sendError(req, res, {
        statusCode: status,
        message: error.publicMessage || error.message || "Request failed.",
        code: error.code,
        includeRequestId: error.includeRequestId,
        includeCode: error.includeCode,
        includeDebug: error.includeDebug,
        debug: {
            message: error.message,
            location,
            stack: error.stack,
            details: error.details,
        },
    });
};

module.exports = {
    notFoundHandler,
    errorHandler,
};
