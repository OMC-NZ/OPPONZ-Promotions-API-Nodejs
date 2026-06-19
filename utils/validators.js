const MAORI_LETTERS = "A-Za-zĀāĒēĪīŌōŪū";

const createValidator = (name, validate, options = {}) => ({
    name,
    validate,
    optional: Boolean(options.optional),
});

const isEmptyValue = (value) => value === undefined || value === null || value === "";

const required = (message = "This field is required.") => createValidator("required", (value) => {
    if (isEmptyValue(value)) {
        return { valid: false, message };
    }

    return { valid: true };
});

const optional = () => createValidator("optional", () => ({ valid: true }), { optional: true });

const email = (message = "Must be a valid email address.") => createValidator("email", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const text = String(value).trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const imei = (message = "IMEI must be a 15-digit number starting with 86.") => createValidator("imei", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const text = String(value).trim();
    const valid = /^86\d{13}$/.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const contact = (message = "Contact must contain digits only.") => createValidator("contact", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const text = String(value).trim();
    const valid = /^\d+$/.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const postcode = (message = "Postcode must be a 4-digit string.") => createValidator("postcode", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const text = String(value).trim();
    const valid = /^\d{4}$/.test(text);

    return valid
        ? { valid: true, value: text }
        : { valid: false, message };
});

const uppercaseFirstLetter = (word) => {
    if (!word) return word;
    return `${word.charAt(0).toLocaleUpperCase("en-NZ")}${word.slice(1).toLocaleLowerCase("en-NZ")}`;
};

const titleCaseWords = (value) => {
    return String(value)
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .map((word) => {
            if (!new RegExp(`[${MAORI_LETTERS}]`).test(word)) return word;

            return word.replace(new RegExp(`[${MAORI_LETTERS}]+`, "g"), uppercaseFirstLetter);
        })
        .join(" ");
};

const titleCaseStreet = (value) => {
    return titleCaseWords(value).replace(/(\d)([a-zāēīōū])/gi, (match, number, letter) => {
        return `${number}${letter.toLocaleUpperCase("en-NZ")}`;
    });
};

const maoriEnglishName = () => {
    return createValidator("maoriEnglishName", (value) => {
        if (isEmptyValue(value)) return { valid: true };

        const normalized = titleCaseWords(value);

        return { valid: true, value: normalized };
    });
};

const street = () => {
    return createValidator("street", (value) => {
        if (isEmptyValue(value)) return { valid: true };

        const normalized = titleCaseStreet(value);

        return { valid: true, value: normalized };
    });
};

const stringLength = ({ min = 0, max, message } = {}) => createValidator("stringLength", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const text = String(value);
    const validMin = text.length >= min;
    const validMax = max === undefined || text.length <= max;

    return validMin && validMax
        ? { valid: true, value: text }
        : { valid: false, message: message || `Must be between ${min} and ${max || "unlimited"} characters.` };
});

const integer = (message = "Must be an integer.") => createValidator("integer", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    const text = String(value).trim();
    const valid = /^-?\d+$/.test(text);

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

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
        ? { valid: false, message }
        : { valid: true, value };
});

const url = (message = "Must be a valid URL.") => createValidator("url", (value) => {
    if (isEmptyValue(value)) return { valid: true };

    try {
        new URL(String(value));
        return { valid: true, value: String(value) };
    } catch (error) {
        return { valid: false, message };
    }
});

module.exports = {
    required,
    optional,
    email,
    imei,
    contact,
    postcode,
    maoriEnglishName,
    street,
    stringLength,
    integer,
    oneOf,
    date,
    url,
    titleCaseWords,
    titleCaseStreet,
};
