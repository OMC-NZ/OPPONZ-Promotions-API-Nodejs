const config = require("./envConfig");

const isDisabled = (value, fallback = false) => {
    if (value === undefined) return fallback;
    return String(value).trim() === "1";
};

const isDevelopment = config.environment === "development";

const securityFeatures = {
    recaptcha: {
        disabled: isDisabled(process.env.RECAPTCHA_DISABLED, isDevelopment),
    },
};

const isRecaptchaEnabled = () => !securityFeatures.recaptcha.disabled;

module.exports = {
    securityFeatures,
    isRecaptchaEnabled,
};
