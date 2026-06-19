const { sendError } = require("../utils/apiResponse");
const { redactSensitiveData } = require("../utils/redactSensitiveData");

const requestLocations = ["body", "query", "params"];

const getLocationData = (req, location) => {
    return req[location] || {};
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isOptionalField = (validators) => validators.some((validator) => validator.optional);

const runValidators = ({ value, validators }) => {
    let currentValue = value;

    for (const validator of validators) {
        const result = validator.validate(currentValue);

        if (!result.valid) {
            return {
                valid: false,
                validator: validator.name,
                message: result.message,
            };
        }

        if (hasOwn(result, "value")) {
            currentValue = result.value;
        }
    }

    return {
        valid: true,
        value: currentValue,
    };
};

const validateLocation = ({ req, location, rules, allowUnknown }) => {
    const data = getLocationData(req, location);
    const errors = [];
    const allowedFields = new Set(Object.keys(rules));

    if (!allowUnknown) {
        Object.keys(data).forEach((field) => {
            if (!allowedFields.has(field)) {
                errors.push({
                    location,
                    field,
                    message: "Unknown field is not allowed.",
                    code: "UNKNOWN_FIELD",
                });
            }
        });
    }

    Object.entries(rules).forEach(([field, validators]) => {
        const validatorList = Array.isArray(validators) ? validators : [validators];
        const exists = hasOwn(data, field);
        const value = data[field];

        if (!exists && isOptionalField(validatorList)) {
            return;
        }

        const result = runValidators({
            value,
            validators: validatorList,
        });

        if (!result.valid) {
            errors.push({
                location,
                field,
                message: result.message,
                code: result.validator,
            });
            return;
        }

        if (exists && result.value !== value) {
            data[field] = result.value;
        }
    });

    return errors;
};

const validateRequest = (schema = {}, options = {}) => {
    const allowUnknown = Boolean(options.allowUnknown);

    return (req, res, next) => {
        const errors = requestLocations.flatMap((location) => {
            if (!schema[location]) return [];

            return validateLocation({
                req,
                location,
                rules: schema[location],
                allowUnknown,
            });
        });

        if (errors.length > 0) {
            return sendError(req, res, {
                statusCode: 400,
                message: "Bad Request",
                code: "VALIDATION_ERROR",
                debug: {
                    errors: redactSensitiveData(errors),
                },
            });
        }

        return next();
    };
};

module.exports = {
    validateRequest,
};
