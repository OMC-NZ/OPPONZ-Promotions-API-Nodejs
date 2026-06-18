const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const parseInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const parseNumber = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const parseList = (value) => {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

module.exports = {
    environment: process.env.NODE_ENV || 'development',
    app: {
        port: parseInteger(process.env.PORT || process.env.APP_PORT, undefined),
        apiVersion: process.env.API_VERSION,
        corsOrigins: parseList(process.env.CORS_ORIGINS),
    },
    db: {
        host: process.env.DB_HOST,
        port: parseInteger(process.env.DB_PORT, 3306),
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        name: process.env.DB_NAME,
        poolMax: parseInteger(process.env.DB_POOL_MAX, 10),
        poolMin: parseInteger(process.env.DB_POOL_MIN, 0),
        acquire: parseInteger(process.env.DB_POOL_ACQUIRE, 30000),
        idle: parseInteger(process.env.DB_POOL_IDLE, 10000),
        connectTimeout: parseInteger(process.env.DB_CONNECT_TIMEOUT, 20000),
    },
    ddb: {
        host: process.env.DDB_HOST,
        port: parseInteger(process.env.DDB_PORT, 3306),
        user: process.env.DDB_USER,
        pass: process.env.DDB_PASS,
        name: process.env.DDB_NAME,
        required: process.env.DDB_REQUIRED === "true",
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: parseInteger(process.env.EMAIL_PORT, undefined),
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    oneDrive: {
        bannerCID: process.env.ONEDRIVE_BANES_CLIENT_ID || process.env.ONEDRIVE_BANNERS_CLIENT_ID,
        bannerCS: process.env.ONEDRIVE_BANES_CLIENT_SECRET || process.env.ONEDRIVE_BANNERS_CLIENT_SECRET,
        bannerTID: process.env.ONEDRIVE_BANES_TENANT_ID || process.env.ONEDRIVE_BANNERS_TENANT_ID,
        redirectURI: process.env.ONEDRIVE_REDIRECT_URI,
    },
    common: {
        tokenSecret: process.env.TOKEN_SECRET,
    },
    recaptcha: {
        secretKey: process.env.RECAPTCHA_SECRET_KEY,
        minScore: parseNumber(process.env.RECAPTCHA_MIN_SCORE, 0.3),
    },
};
