const assert = require("node:assert/strict");
const path = require("node:path");
const dotenv = require("dotenv");
const { test } = require("node:test");
const { loadModule } = require("./helpers/loadModule");

const loadConfig = (environment, environmentFile) => {
    const env = { NODE_ENV: environment, ...(environmentFile ? { ENV_FILE: environmentFile } : {}) };
    const files = {
        ".env": "DB_POOL_MAX=8\n",
        ".env.development": [
            "DDB_HOST=dev.example.invalid", "DDB_USER=dev", "DDB_PASS=dev-password", "DDB_NAME=development",
            "APP_PORT=3000", "RECAPTCHA_DISABLED=1", "CORS_ORIGINS=http://localhost:3001",
        ].join("\n"),
        ".env.production": [
            "DB_HOST=prod.example.invalid", "DB_USER=prod", "DB_PASS=prod-password", "DB_NAME=production",
            "DB_PORT=3307", "DB_POOL_MAX=4", "NODE_ENV=production", "APP_PORT=80",
            "RECAPTCHA_DISABLED=0", "CORS_ORIGINS=https://production.example",
        ].join("\n"),
        ".env.test.prod": "DB_HOST=test.example.invalid\nDB_USER=test\nDB_PASS=test-password\nDB_NAME=test-production\nAPP_PORT=3000\n",
    };
    let isolatedReads = 0;
    const config = loadModule("config/envConfig.js", {
        dotenv: {
            parse: dotenv.parse,
            config: ({ path: file, override }) => {
                const parsed = dotenv.parse(files[path.basename(file)] || "");
                for (const [key, value] of Object.entries(parsed)) {
                    if (override || env[key] === undefined) env[key] = value;
                }
                return { parsed };
            },
        },
        fs: { readFileSync: (file) => {
            assert.equal(path.basename(file), ".env.production");
            isolatedReads += 1;
            return Buffer.from(files[".env.production"]);
        } },
    }, { process: { env }, __dirname: path.resolve(__dirname, "../config") });
    return { config, env, isolatedReads: () => isolatedReads };
};

test("development current-list DB settings load from production without requiring DB_* in development", () => {
    const { config, env, isolatedReads } = loadConfig("development");
    assert.equal(config.db.host, undefined);
    assert.equal(isolatedReads(), 0);
    const settings = config.getCurrentListDatabaseConfig();
    assert.equal(settings.host, "prod.example.invalid");
    assert.equal(settings.name, "production");
    assert.equal(settings.port, 3307);
    assert.equal(settings.poolMax, 4);
    assert.equal(config.getCurrentListDatabaseConfig(), settings);
    assert.equal(isolatedReads(), 1);
    assert.equal(config.ddb.name, "development");
    assert.equal(config.environment, "development");
    assert.equal(config.app.port, 3000);
    assert.deepEqual(config.app.corsOrigins, ["http://localhost:3001"]);
    assert.equal(env.RECAPTCHA_DISABLED, "1");
    assert.equal(env.NODE_ENV, "development");
    assert.equal(env.DB_HOST, undefined);
});

test("production retains its normal DB settings without an extra production-file parse", () => {
    const { config, isolatedReads } = loadConfig("production");
    assert.equal(config.getCurrentListDatabaseConfig(), config.db);
    assert.equal(config.db.name, "production");
    assert.equal(isolatedReads(), 0);
});

test("local production-env testing continues to use .env.test.prod DB settings", () => {
    const { config, isolatedReads } = loadConfig("production", ".env.test.prod");
    assert.equal(config.getCurrentListDatabaseConfig().name, "test-production");
    assert.equal(config.db.host, "test.example.invalid");
    assert.equal(config.app.port, 3000);
    assert.equal(isolatedReads(), 0);
});
