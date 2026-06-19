const config = require("./envConfig");

const isProduction = config.environment === "production";

const getHelmetOptions = () => ({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: {
    policy: "same-origin",
  },
  crossOriginResourcePolicy: {
    policy: "same-site",
  },
  frameguard: {
    action: "deny",
  },
  hsts: isProduction
    ? {
        maxAge: 15552000,
        includeSubDomains: true,
        preload: false,
      }
    : false,
  noSniff: true,
  referrerPolicy: {
    policy: "no-referrer",
  },
});

module.exports = getHelmetOptions;
