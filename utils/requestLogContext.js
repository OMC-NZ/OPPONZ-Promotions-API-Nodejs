const { redactSensitiveData } = require("./redactSensitiveData");

const firstPresentValue = (...values) => {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return undefined;
};

const getRequestLogContext = (req) => {
    const body = req.body || {};
    const query = req.query || {};
    const params = req.params || {};

    return redactSensitiveData({
        identifiers: {
            imei: firstPresentValue(body.imei, query.imei, params.imei),
            claim_id: firstPresentValue(body.claim_id, query.claim_id, params.claim_id),
            event_claim_id: firstPresentValue(
                body.event_claim_id,
                query.event_claim_id,
                params.event_claim_id
            ),
            email: firstPresentValue(body.email, query.email),
            promotion_id: firstPresentValue(body.promotion_id, query.promotion_id, params.promotion_id),
            event_id: firstPresentValue(body.event_id, query.event_id, params.event_id),
            slug: firstPresentValue(body.slug, body.slug_url, query.slug, query.slug_url, params.slug),
            recaptcha_action: firstPresentValue(
                body.recaptcha_action,
                query.recaptcha_action,
                req.get?.("x-recaptcha-action")
            ),
        },
        fields: {
            body: Object.keys(body),
            query: Object.keys(query),
            params: Object.keys(params),
            files: req.files
                ? Array.isArray(req.files)
                    ? req.files.map((file) => file.fieldname)
                    : Object.keys(req.files)
                : [],
        },
    });
};

module.exports = {
    getRequestLogContext,
};
