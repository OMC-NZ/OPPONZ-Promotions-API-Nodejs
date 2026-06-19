const REDACTED = "[REDACTED]";

const fullRedactKeys = new Set([
    "authorization",
    "cookie",
    "password",
    "pass",
    "token",
    "apikey",
    "api_key",
    "x-api-key",
    "secret",
    "client_secret",
    "recaptchatoken",
    "recaptcha_token",
]);

const partialRedactKeys = new Set([
    "email",
    "contact",
    "phone",
    "mobile",
    "imei",
]);

const fileUrlKeys = new Set([
    "receipt_url",
    "screenshot_url",
]);

const addressKeys = new Set([
    "street",
    "address",
    "deliver_address",
    "delivery_address",
]);

const normalizeKey = (key) => String(key || "").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();

const shouldFullyRedact = (key) => {
    const normalized = normalizeKey(key);
    return fullRedactKeys.has(normalized) ||
        normalized.includes("password") ||
        normalized.includes("token") ||
        normalized.includes("secret") ||
        normalized.includes("apikey");
};

const maskEmail = (value) => {
    const [localPart, domain] = String(value).split("@");
    if (!localPart || !domain) return REDACTED;
    return `${localPart.slice(0, 1)}***@${domain}`;
};

const maskTail = (value, visibleLength = 4) => {
    const text = String(value);
    if (text.length <= visibleLength) return "*".repeat(text.length);
    return `${"*".repeat(Math.max(text.length - visibleLength, 0))}${text.slice(-visibleLength)}`;
};

const maskPartialValue = (key, value) => {
    const normalized = normalizeKey(key);

    if (normalized === "email") {
        return maskEmail(value);
    }

    if (normalized === "imei") {
        return maskTail(value, 4);
    }

    return maskTail(value, 4);
};

const keepFileNameOnly = (value) => {
    const text = String(value);
    const cleanText = text.split("?")[0].split("#")[0];
    const parts = cleanText.split(/[\\/]/).filter(Boolean);
    const fileName = parts[parts.length - 1];
    return fileName ? `.../${fileName}` : REDACTED;
};

const redactQueryValue = (key, value) => {
    const normalized = normalizeKey(key);

    if (shouldFullyRedact(normalized)) {
        return REDACTED;
    }

    if (partialRedactKeys.has(normalized)) {
        return maskPartialValue(normalized, value);
    }

    if (fileUrlKeys.has(normalized)) {
        return keepFileNameOnly(value);
    }

    if (addressKeys.has(normalized)) {
        return REDACTED;
    }

    return value;
};

const redactUrlQuery = (value) => {
    const text = String(value);
    if (!text.includes("?")) return text;

    try {
        const url = new URL(text, "http://redaction.local");
        url.searchParams.forEach((paramValue, paramKey) => {
            url.searchParams.set(paramKey, redactQueryValue(paramKey, paramValue));
        });

        const query = url.searchParams.toString();
        return `${url.pathname}${query ? `?${query}` : ""}${url.hash || ""}`;
    } catch (error) {
        return text.replace(/([?&][^=]*(?:token|secret|password|api[_-]?key)[^=]*=)[^&]*/gi, `$1${REDACTED}`);
    }
};

const redactStringPatterns = (value) => {
    return redactUrlQuery(String(value))
        .replace(/(authorization:\s*bearer\s+)[^\s,;]+/gi, `$1${REDACTED}`)
        .replace(/(x-api-key:\s*)[^\s,;]+/gi, `$1${REDACTED}`)
        .replace(/((?:password|token|secret|api[_-]?key)=)[^&\s,;]+/gi, `$1${REDACTED}`);
};

const redactSensitiveData = (value, key, seen = new WeakSet()) => {
    if (value === null || value === undefined) return value;

    if (shouldFullyRedact(key)) {
        return REDACTED;
    }

    const normalized = normalizeKey(key);

    if (partialRedactKeys.has(normalized)) {
        return maskPartialValue(normalized, value);
    }

    if (fileUrlKeys.has(normalized)) {
        return keepFileNameOnly(value);
    }

    if (addressKeys.has(normalized)) {
        return REDACTED;
    }

    if (typeof value === "string") {
        return redactStringPatterns(value);
    }

    if (typeof value !== "object") {
        return value;
    }

    if (seen.has(value)) {
        return "[CIRCULAR]";
    }
    seen.add(value);

    if (Array.isArray(value)) {
        return value.map((item) => redactSensitiveData(item, key, seen));
    }

    return Object.fromEntries(
        Object.entries(value).map(([entryKey, entryValue]) => [
            entryKey,
            redactSensitiveData(entryValue, entryKey, seen),
        ])
    );
};

const redactError = (error) => {
    if (!error) return error;

    return {
        name: error.name,
        message: redactSensitiveData(error.message, "message"),
        stack: redactSensitiveData(error.stack, "stack"),
        details: redactSensitiveData(error.details, "details"),
    };
};

module.exports = {
    REDACTED,
    redactSensitiveData,
    redactError,
};
