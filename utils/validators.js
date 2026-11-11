const moment = require("moment-timezone");
const { isStrictProductionSecurity } = require("../config/securityFeatureConfig");
const { toScalarText } = require("./text");
const { allowedExtensions } = require("./claimFilePolicy");

const MAORI_LETTERS = "A-Za-z\\u0100\\u0112\\u012A\\u014C\\u016A\\u0101\\u0113\\u012B\\u014D\\u016B";
const NAME_PATTERN = new RegExp(`^[${MAORI_LETTERS}]+(?: [${MAORI_LETTERS}]+)*$`);
const DEFAULT_ALLOWED_FILE_EXTENSIONS = [...allowedExtensions];

const createValidator = (name, validate, options = {}) => ({
    name,
    validate,
    optional: Boolean(options.optional),
});

const isEmptyValue = (value) => value === undefined || value === null || value === "";

const invalidFormat = (message = "Invalid format.") => ({ valid: false, message });

const required = (message = "This field is required.") => createValidator("required", (value) => {
    if (isEmptyValue(value)) {
        return { valid: false, message };
    }

    return { valid: true };
});

const optional = () => createValidator("optional", () => ({ valid: true }), { optional: true });

const jsonObject = () => createValidator("jsonObject", (value) => {
    if (isEmptyValue(value)) return { valid: true };
    if (typeof value !== "string") return invalidFormat("Must be a JSON object string.");
    try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return invalidFormat("Must be a JSON object string.");
        const pending = [{ value: parsed, depth: 0 }];
        while (pending.length) {
            const item = pending.pop();
            if (item.depth > 12) return invalidFormat("JSON nesting is too deep.");
            for (const [key, child] of Object.entries(item.value)) {
                if (["__proto__", "prototype", "constructor"].includes(key)) return invalidFormat("Invalid JSON field.");
                if (child && typeof child === "object") pending.push({ value: child, depth: item.depth + 1 });
            }
        }
        return { valid: true };
    } catch (error) {
        return invalidFormat("Must be a JSON object string.");
    }
});

const giftAliases = () => createValidator("giftAliases", (value) => {
    let aliases = value;

    // Multipart fields carry arrays as JSON text.
    if (typeof aliases === "string") {
        try {
            aliases = JSON.parse(aliases);
        } catch (error) {
            return invalidFormat("Gift aliases must be a non-empty array of strings.");
        }
    }

    if (!Array.isArray(aliases) || aliases.length === 0 || aliases.some((alias) => (
        typeof alias !== "string" || alias.trim().length === 0 || alias.length > 45
    ))) {
        return invalidFormat("Gift aliases must be a non-empty array of strings, each up to 45 characters.");
    }

    if (new Set(aliases).size !== aliases.length) {
        return invalidFormat("Duplicate gift aliases are not allowed.");
    }

    return { valid: true, value: aliases };
});

const email = (message = "Must be a valid email address.") => createValidator("email", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const scalarText = toScalarText(value);
    if (scalarText === null) return invalidFormat(message);

    const text = scalarText.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const imei = (message = "IMEI must be a 15-digit number starting with 86.") => createValidator("imei", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const scalarText = toScalarText(value);
    if (scalarText === null) return invalidFormat(message);

    const text = scalarText.replace(/\s+/g, "").trim();
    const valid = /^86\d{13}$/.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const contact = (message = "Contact must contain digits only.") => createValidator("contact", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const scalarText = toScalarText(value);
    if (scalarText === null) return invalidFormat(message);

    const text = scalarText.replace(/\s+/g, "").trim();
    const valid = /^\d+$/.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const postcode = (message = "Postcode must be a 4-digit string.") => createValidator("postcode", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const scalarText = toScalarText(value);
    if (scalarText === null) return invalidFormat(message);

    const text = scalarText.trim();
    const valid = /^\d{4}$/.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const invoiceNumber = (
    message = "Invoice number may contain letters, numbers, and hyphens only."
) => createValidator("invoiceNumber", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const scalarText = toScalarText(value);
    if (scalarText === null) return invalidFormat(message);

    const text = scalarText;
    const valid = /[0-9]/.test(text) && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const claimReference = (
    message = "Claim reference format is invalid."
) => createValidator("claimReference", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const scalarText = toScalarText(value);
    if (scalarText === null) return invalidFormat(message);

    const text = scalarText.trim();
    const promotionClaimPattern = /^OPNZPROCLM-\d{6}-.+/i;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const valid = promotionClaimPattern.test(text) || uuidPattern.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const uppercaseFirstLetter = (word) => {
    if (!word) return word;
    return `${word.charAt(0).toLocaleUpperCase("en-NZ")}${word.slice(1).toLocaleLowerCase("en-NZ")}`;
};

const titleCaseLetters = (value) => {
    return value
        .toLocaleLowerCase("en-NZ")
        .replace(new RegExp(`[${MAORI_LETTERS}]+`, "g"), uppercaseFirstLetter);
};

const titleCaseWords = (value) => {
    return value
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .map((word) => {
            if (!new RegExp(`[${MAORI_LETTERS}]`).test(word)) return word;

            return titleCaseLetters(word);
        })
        .join(" ");
};

const titleCaseStreet = (value) => {
    return titleCaseWords(value).replace(
        new RegExp(`(\\d)([a-z\\u0101\\u0113\\u012B\\u014D\\u016B])`, "gi"),
        (match, number, letter) => `${number}${letter.toLocaleUpperCase("en-NZ")}`
    );
};

const maoriEnglishName = () => {
    return createValidator("maoriEnglishName", (value) => {
        if (isEmptyValue(value)) return { valid: true };

        const scalarText = toScalarText(value);
        if (scalarText === null) return invalidFormat();

        const normalized = titleCaseWords(scalarText);
        const valid = NAME_PATTERN.test(normalized);

        return valid
            ? { valid: true, value: normalized }
            : { valid: false, message: "Invalid format." };
    });
};

const street = () => {
    return createValidator("street", (value) => {
        if (isEmptyValue(value)) return { valid: true };

        const scalarText = toScalarText(value);
        if (scalarText === null) return invalidFormat();

        const normalized = titleCaseStreet(scalarText);

        return { valid: true, value: normalized };
    });
};

const titleCaseText = () => {
    return createValidator("titleCaseText", (value) => {
        if (isEmptyValue(value)) return { valid: true };

        const scalarText = toScalarText(value);
        if (scalarText === null) return invalidFormat();

        return { valid: true, value: titleCaseWords(scalarText) };
    });
};

const stringLength = ({ min = 0, max, message } = {}) => createValidator("stringLength", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const text = toScalarText(value);
    if (text === null) return invalidFormat(message);

    const validMin = text.length >= min;
    const validMax = max === undefined || text.length <= max;

    return validMin && validMax
        ? { valid: true, value: text }
        : { valid: false, message: message || `Must be between ${min} and ${max || "unlimited"} characters.` };
});

const integer = (message = "Must be an integer.") => createValidator("integer", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const scalarText = toScalarText(value);
    if (scalarText === null) return invalidFormat(message);

    const text = scalarText.trim();
    const valid = /^-?\d+$/.test(text) && Number.isSafeInteger(Number(text));

    return valid
        ? { valid: true, value: Number.parseInt(text, 10) }
        : { valid: false, message };
});

const oneOf = (allowedValues, message) => createValidator("oneOf", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    return allowedValues.includes(value)
        ? { valid: true }
        : { valid: false, message: message || `Must be one of: ${allowedValues.join(", ")}.` };
});

const date = (message = "Must be a valid date.") => createValidator("date", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const text = toScalarText(value);
    if (text === null) return invalidFormat(message);

    const valid = moment(text, moment.ISO_8601, true).isValid();

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const url = (message = "Must be a valid URL.") => createValidator("url", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const text = toScalarText(value);
    if (text === null) return invalidFormat(message);

    try {
        new URL(text);
        return { valid: true, value: text };
    } catch (error) {
        return { valid: false, message };
    }
});

const fileExtension = (
    allowedExtensions = DEFAULT_ALLOWED_FILE_EXTENSIONS,
    message = "Unsupported file type."
) => createValidator("fileExtension", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const scalarText = toScalarText(value);
    if (scalarText === null) return invalidFormat(message);

    const text = scalarText.trim();
    const queryIndex = text.search(/[?#]/);
    const pathPart = queryIndex === -1 ? text : text.slice(0, queryIndex);
    const fileName = pathPart.split(/[\\/]/).pop() || "";
    const dotIndex = fileName.lastIndexOf(".");

    if (dotIndex <= 0) {
        return { valid: false, message };
    }

    const extension = fileName.slice(dotIndex).toLowerCase();
    const valid = allowedExtensions.map((item) => item.toLowerCase()).includes(extension);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const recaptchaAction = (allowedValues) => {
    return isStrictProductionSecurity()
        ? [required(), oneOf(allowedValues)]
        : [optional()];
};

const recaptchaToken = () => {
    return isStrictProductionSecurity()
        ? [required()]
        : [optional()];
};

module.exports = {
    required,
    optional,
    jsonObject,
    giftAliases,
    email,
    imei,
    contact,
    postcode,
    invoiceNumber,
    claimReference,
    maoriEnglishName,
    street,
    titleCaseText,
    stringLength,
    integer,
    oneOf,
    date,
    url,
    fileExtension,
    recaptchaAction,
    recaptchaToken,
    titleCaseWords,
    titleCaseStreet,
};
