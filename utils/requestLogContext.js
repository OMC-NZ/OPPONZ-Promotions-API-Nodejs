const { redactSensitiveData } = require("./redactSensitiveData");

const firstPresentValue = (...values) => {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return undefined;
};

const compactObject = (value) => {
    return Object.fromEntries(
        Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "")
    );
};

const hasAnyField = (fields) => {
    return Object.values(fields).some((items) => Array.isArray(items) && items.length > 0);
};

const getRequestLogContext = (req) => {
    const body = req.body || {};
    const query = req.query || {};
    const params = req.params || {};
    const identifiers = compactObject({
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
    });
    const recaptchaAction = firstPresentValue(
        body.recaptcha_action,
        query.recaptcha_action,
        req.get?.("x-recaptcha-action")
    );
    const fields = {
        body: Object.keys(body),
        query: Object.keys(query),
        params: Object.keys(params),
        files: req.files
            ? Array.isArray(req.files)
                ? req.files.map((file) => file.fieldname)
                : Object.keys(req.files)
            : [],
    };
    const context = {};

    if (Object.keys(identifiers).length > 0) {
        context.identifiers = identifiers;
    }

    if (recaptchaAction) {
        context.security = {
            recaptcha_action: recaptchaAction,
        };
    }

    if (hasAnyField(fields)) {
        context.fields = fields;
    }

    return redactSensitiveData(context);
};

module.exports = {
    getRequestLogContext,
};
