const crypto = require("crypto");

const requestContext = (req, res, next) => {
    const incomingRequestId = String(req.get("x-request-id") || "").trim();
    const requestId = /^[A-Za-z0-9_-]{1,128}$/.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID();

    req.requestId = requestId;
    res.set("X-Request-Id", requestId);

    next();
};

module.exports = {
    requestContext,
};
