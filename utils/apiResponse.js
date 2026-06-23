const config = require("../config/envConfig");

const isProduction = config.environment === "production";

const DEFAULT_ERROR_MESSAGES = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Route not found.",
    405: "Method Not Allowed",
    409: "Conflict",
    413: "Payload Too Large",
    429: "You have tried too many times. Please wait a moment and try again.",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
};

const getDefaultErrorMessage = (statusCode) => {
    return DEFAULT_ERROR_MESSAGES[statusCode] || (statusCode >= 500 ? "Internal Server Error" : "Request failed.");
};

const shouldExposeErrorMessage = (statusCode) => statusCode < 500 || !isProduction;

const sendSuccess = (req, res, options = {}) => {
    const statusCode = options.statusCode || 200;
    const payload = {
        success: true,
        data: options.data === undefined ? null : options.data,
        requestId: req.requestId,
    };

    if (options.message) {
        payload.message = options.message;
    }

    if (options.meta) {
        payload.meta = options.meta;
    }

    return res.status(statusCode).json(payload);
};

const sendError = (req, res, options = {}) => {
    const statusCode = options.statusCode || options.status || 500;
    const fallbackMessage = getDefaultErrorMessage(statusCode);
    const requestedMessage = options.publicMessage || options.message || fallbackMessage;
    const payload = {
        success: false,
        message: shouldExposeErrorMessage(statusCode) ? requestedMessage : fallbackMessage,
        requestId: req.requestId,
    };

    if (options.code) {
        payload.code = options.code;
    }

    if (!isProduction && options.debug) {
        payload.debug = options.debug;
    }

    return res.status(statusCode).json(payload);
};

module.exports = {
    sendSuccess,
    sendError,
    getDefaultErrorMessage,
    shouldExposeErrorMessage,
};
