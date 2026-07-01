const dotenv = require("dotenv");
const path = require("path");

const baseEnvPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: baseEnvPath });

const runtimeEnvironment = process.env.NODE_ENV || "development";
const environmentEnvPath = path.resolve(__dirname, `../.env.${runtimeEnvironment}`);
dotenv.config({
    path: environmentEnvPath,
    override: true,
});

process.env.NODE_ENV = runtimeEnvironment;

const parseInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const parseNumber = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const parseBoolean = (value, fallback = false) => {
    if (value === undefined) return fallback;
    return value === "true";
};

const parseTrustProxy = (value) => {
    if (!value || value === "false") return false;
    if (value === "true") return true;

    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;

    return value;
};

const parseList = (value) => {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

module.exports = {
    environment: runtimeEnvironment,
    envFiles: {
        base: baseEnvPath,
        environment: environmentEnvPath,
    },
    app: {
        port: parseInteger(process.env.PORT || process.env.APP_PORT, undefined),
        apiVersion: process.env.API_VERSION,
        corsOrigins: parseList(process.env.CORS_ORIGINS),
        trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
        ipDebug: parseBoolean(process.env.IP_DEBUG, runtimeEnvironment === "development"),
        enforceHttps: parseBoolean(process.env.ENFORCE_HTTPS),
        bodyLimit: process.env.BODY_LIMIT || "100kb",
    },
    logs: {
        directory: process.env.LOG_DIR || "logs",
        retentionDays: parseInteger(process.env.LOG_RETENTION_DAYS, 21),
        cleanupIntervalMs: parseInteger(process.env.LOG_CLEANUP_INTERVAL_MS, 60 * 60 * 1000),
    },
    server: {
        requestTimeoutMs: parseInteger(process.env.SERVER_REQUEST_TIMEOUT_MS, 30000),
        headersTimeoutMs: parseInteger(process.env.SERVER_HEADERS_TIMEOUT_MS, 10000),
        keepAliveTimeoutMs: parseInteger(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS, 5000),
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
        poolMax: parseInteger(process.env.DDB_POOL_MAX, 10),
        poolMin: parseInteger(process.env.DDB_POOL_MIN, 0),
        acquire: parseInteger(process.env.DDB_POOL_ACQUIRE, 30000),
        idle: parseInteger(process.env.DDB_POOL_IDLE, 10000),
        connectTimeout: parseInteger(process.env.DDB_CONNECT_TIMEOUT, 20000),
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: parseInteger(process.env.EMAIL_PORT, undefined),
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM,
        serviceEmail: process.env.EMAIL_USER,
        trackingUrl: process.env.CLAIM_TRACKING_URL || "https://oppopromotions.co.nz",
        adminEmail: process.env.EMAIL_ADMIN || process.env.EMAIL_ADMIN,
        alertCooldownMs: parseInteger(process.env.ERROR_ALERT_COOLDOWN_MS, 300000),
    },
    nzPost: {
        tokenUrl: process.env.NZ_POST_TOKEN_URL,
        addressCheckerUrl: process.env.NZPOST_ADDRESSCHECKER_URL || "https://api.nzpost.co.nz/addresschecker/1.0",
        clientId: process.env.NZPOST_ADDRESSCHECKER_CLIENT_ID,
        clientSecret: process.env.NZPOST_ADDRESSCHECKER_CLIENT_SECRET,
        tokenRefreshBufferSeconds: parseInteger(process.env.NZ_POST_TOKEN_REFRESH_BUFFER_SECONDS, 60),
        tokenFallbackTtlSeconds: parseInteger(process.env.NZ_POST_TOKEN_FALLBACK_TTL_SECONDS, 30 * 60),
    },
    common: {
        tokenSecret: process.env.TOKEN_SECRET,
        internalApiKeys: parseList(process.env.INTERNAL_API_KEYS),
    },
    recaptcha: {
        secretKey: process.env.RECAPTCHA_SECRET_KEY_V3,
        minScore: parseNumber(process.env.RECAPTCHA_MIN_SCORE, 0.3),
    },
    r2: {
        endpoint: process.env.R2_ENDPOINT,
        bucket: process.env.R2_BUCKET,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        publicBaseUrl: process.env.R2_PUBLIC_ASSETS_URL || process.env.R2_PUBLIC_BASE_URL,
        uploadMaxBytes: parseInteger(process.env.R2_UPLOAD_MAX_BYTES, 5 * 1024 * 1024),
    },
    rateLimit: {
        windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
        max: parseInteger(process.env.RATE_LIMIT_MAX, 200),
        publicWindowMs: parseInteger(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
        publicMax: parseInteger(process.env.PUBLIC_RATE_LIMIT_MAX, 300),
        writeWindowMs: parseInteger(process.env.WRITE_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
        writeMax: parseInteger(process.env.WRITE_RATE_LIMIT_MAX, 10),
        recaptchaWindowMs: parseInteger(process.env.RECAPTCHA_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
        recaptchaMax: parseInteger(process.env.RECAPTCHA_RATE_LIMIT_MAX, 20),
    },
};
