const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

const baseEnvPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: baseEnvPath });

const runtimeEnvironment = process.env.NODE_ENV || "development";
const getEnvironmentEnvFileName = () => {
    const requestedEnvFile = process.env.ENV_FILE;

    if (!requestedEnvFile) {
        return `.env.${runtimeEnvironment}`;
    }

    const envFileName = path.basename(requestedEnvFile);

    if (envFileName !== requestedEnvFile || !envFileName.startsWith(".env.")) {
        throw new Error("ENV_FILE must be a local .env.* file name.");
    }

    return envFileName;
};

const environmentEnvFileName = getEnvironmentEnvFileName();
const environmentEnvPath = path.resolve(__dirname, `../${environmentEnvFileName}`);
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

const buildDatabaseConfig = (prefix, values = process.env) => ({
    host: values[`${prefix}_HOST`],
    port: parseInteger(values[`${prefix}_PORT`], 3306),
    user: values[`${prefix}_USER`],
    pass: values[`${prefix}_PASS`],
    name: values[`${prefix}_NAME`],
    poolMax: parseInteger(values[`${prefix}_POOL_MAX`], 10),
    poolMin: parseInteger(values[`${prefix}_POOL_MIN`], 0),
    acquire: parseInteger(values[`${prefix}_POOL_ACQUIRE`], 30000),
    idle: parseInteger(values[`${prefix}_POOL_IDLE`], 10000),
    connectTimeout: parseInteger(values[`${prefix}_CONNECT_TIMEOUT`], 20000),
});

const db = buildDatabaseConfig("DB");
let currentListDatabaseConfig;

const getCurrentListDatabaseConfig = () => {
    if (runtimeEnvironment !== "development") return db;
    if (!currentListDatabaseConfig) {
        // Parse in isolation for selected DB read endpoints without changing the development environment.
        const productionEnvPath = path.resolve(__dirname, "../.env.production");
        const values = dotenv.parse(fs.readFileSync(productionEnvPath));
        currentListDatabaseConfig = buildDatabaseConfig("DB", values);
    }
    return currentListDatabaseConfig;
};

module.exports = {
    environment: runtimeEnvironment,
    getCurrentListDatabaseConfig,
    envFiles: {
        base: baseEnvPath,
        environment: environmentEnvPath,
        environmentFileName: environmentEnvFileName,
    },
    app: {
        localProductionTest: parseBoolean(process.env.LOCAL_PRODUCTION_TEST),
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
    db,
    ddb: {
        ...buildDatabaseConfig("DDB"),
        required: process.env.DDB_REQUIRED === "true",
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: parseInteger(process.env.EMAIL_PORT, undefined),
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM,
        serviceEmail: process.env.EMAIL_USER,
        trackingUrl: process.env.CLAIM_TRACKING_URL || "https://oppopromotions.co.nz",
        adminEmail: process.env.EMAIL_ADMIN,
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
        publicBaseUrl: process.env.R2_PUBLIC_ASSETS_URL,
        uploadMaxBytes: parseInteger(process.env.R2_UPLOAD_MAX_BYTES, 5 * 1024 * 1024),
    },
    oneDrive: {
        clientId: process.env.ONEDRIVE_CLIENT_ID,
        clientSecret: process.env.ONEDRIVE_CLIENT_SECRET,
        refreshToken: process.env.ONEDRIVE_REFRESH_TOKEN,
        redirectUri: process.env.ONEDRIVE_REDIRECT_URI || "https://oppopromotions.co.nz/",
        tokenUrl: process.env.ONEDRIVE_TOKEN_URL || "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
        uploadRoot: process.env.ONEDRIVE_UPLOAD_ROOT || "",
        tokenRefreshBufferSeconds: parseInteger(process.env.ONEDRIVE_TOKEN_REFRESH_BUFFER_SECONDS, 60),
    },
    rateLimit: {
        windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
        max: parseInteger(process.env.RATE_LIMIT_MAX, 600),
        publicWindowMs: parseInteger(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
        publicMax: parseInteger(process.env.PUBLIC_RATE_LIMIT_MAX, 500),
        writeWindowMs: parseInteger(process.env.WRITE_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
        writeMax: parseInteger(process.env.WRITE_RATE_LIMIT_MAX, 30),
        imeiVerificationWindowMs: parseInteger(process.env.IMEI_VERIFICATION_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
        imeiVerificationMax: parseInteger(process.env.IMEI_VERIFICATION_RATE_LIMIT_MAX, 20),
        recaptchaWindowMs: parseInteger(process.env.RECAPTCHA_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
        recaptchaMax: parseInteger(process.env.RECAPTCHA_RATE_LIMIT_MAX, 300),
    },
};
