const { logSecurityEvent } = require("../services/securityLogService");
const { sendError } = require("../utils/apiResponse");

const methodNotAllowed = (allowedMethods = []) => {
    const allowed = allowedMethods.map((method) => method.toUpperCase());

    return (req, res) => {
        res.set("Allow", allowed.join(", "));

        logSecurityEvent(req, "METHOD_NOT_ALLOWED", {
            status: 405,
            allowedMethods: allowed,
        });

        return sendError(req, res, {
            statusCode: 405,
            message: "Method Not Allowed",
            code: "METHOD_NOT_ALLOWED",
        });
    };
};

const logRouteNotFound = (req) => {
    logSecurityEvent(req, "ROUTE_NOT_FOUND", {
        status: 404,
    });
};

module.exports = {
    methodNotAllowed,
    logRouteNotFound,
};
