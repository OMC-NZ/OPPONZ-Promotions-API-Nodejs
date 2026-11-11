const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { Op } = require("sequelize");
const { loadModule } = require("./helpers/loadModule");

const databaseSettings = (name) => ({
    name, host: "example.invalid", user: "test", pass: "test", port: 3306,
    poolMax: 10, poolMin: 0, acquire: 30000, idle: 10000, connectTimeout: 20000,
});

const connectionHarness = (environment, db = databaseSettings("db_database")) => {
    const connections = [];
    const config = { environment, db, ddb: databaseSettings("ddb_database"), getCurrentListDatabaseConfig: () => db };
    class Sequelize {
        constructor(name, user, pass, options) {
            this.name = name;
            this.options = options;
            this.closeCount = 0;
            connections.push(this);
        }
        async close() { this.closeCount += 1; }
        async authenticate() {}
    }
    const service = loadModule("config/dbConfig.js", { sequelize: { Sequelize }, "./envConfig": config }, {
        console: { log: () => {}, error: () => {} },
    });
    return { service, connections };
};

test("development keeps DDB active and lazily reuses one separate DB connection", async () => {
    const { service, connections } = connectionHarness("development");
    const active = service.connectDatabase();
    assert.equal(connections.length, 1);
    assert.equal(active.name, "ddb_database");
    assert.equal(active.options.dialect, "mysql");
    const db = service.getDBConnection();
    assert.equal(db.name, "db_database");
    assert.equal(db.options.dialect, "mariadb");
    assert.equal(service.getDBConnection(), db);
    assert.equal(service.connectDatabase(), active);
    assert.equal(service.getDatabase().sequelize, active);
    assert.equal(service.getDatabase().sequelizeDB, db);
    assert.equal(connections.length, 2);
    await service.closeDatabases();
    assert.equal(active.closeCount, 1);
    assert.equal(db.closeCount, 1);
});

test("production and production-env testing reuse the existing DB connection pool", async () => {
    const { service, connections } = connectionHarness("production");
    const active = service.connectDatabase();
    assert.equal(active.name, "db_database");
    assert.equal(service.getDBConnection(), active);
    assert.equal(service.getDBConnection(), active);
    assert.equal(connections.length, 1);
    await service.closeDatabases();
    assert.equal(active.closeCount, 1);
});

test("missing DB configuration fails explicitly without falling back to DDB", () => {
    const { service, connections } = connectionHarness("development", {});
    const active = service.connectDatabase();
    assert.throws(() => service.getDBConnection(), /DB database configuration is incomplete/);
    assert.equal(service.getDatabase().sequelize, active);
    assert.equal(connections.length, 1);
});

const modelHarness = (separate) => {
    const active = { label: "active" };
    const db = separate ? { label: "DB" } : active;
    const calls = [];
    const modelsPath = path.resolve(__dirname, "../models");
    const files = ["Events.js", "Promotions.js", "Channels.js", "Promotion_Channels.js"];
    const factories = Object.fromEntries(files.map((file) => [path.join(modelsPath, "tables", file), (connection) => {
        calls.push(connection);
        return { name: file.slice(0, -3), sequelize: connection };
    }]));
    const modelModule = loadModule("models/index.js", {
        fs: { readdirSync: () => files },
        "../config/dbConfig": {
            getDatabase: () => ({ sequelize: active, sequelizeDB: separate ? undefined : active, sequelizeDDB: separate ? active : undefined }),
            getDBConnection: () => db,
        },
        "./associations": () => {},
        ...factories,
    }, { __dirname: modelsPath });
    return { modelModule, active, db, calls };
};

test("DB model context binds all homepage tables to DB without replacing active DDB models", () => {
    const { modelModule, active, db, calls } = modelHarness(true);
    assert.equal(calls.length, 4);
    const context = modelModule.getDBModelContext();
    assert.equal(context.sequelize, db);
    assert.equal(modelModule.getDBModelContext(), context);
    assert.equal(calls.length, 8);
    for (const model of Object.values(context.models)) assert.equal(model.sequelize, db);
    assert.equal(modelModule.models.active.Events.sequelize, active);
    assert.equal(modelModule.models.development.Events.sequelize, active);
});

test("production reuses the already registered model set", () => {
    const { modelModule, active, calls } = modelHarness(false);
    const context = modelModule.getDBModelContext();
    assert.equal(context.sequelize, active);
    assert.equal(context.models, modelModule.models.active);
    assert.equal(calls.length, 4);
});

const time = { getNewZealandTime: () => "2026-11-11 12:00:00" };
const responses = { sendSuccess: (req, res, options) => Object.assign(res, options) };

test("GET current promotions reads promotion, channel and availability rows only from DB", async () => {
    const queried = [];
    const dbModels = {
        Promotion_Channels: { findAll: async (options) => {
            queried.push("Promotion_Channels");
            assert.ok(options.where[Op.and][0].val.includes("DB_TIME"));
            return [{ promotion_id: 7, channel_code: "TEST", start_date: "2026-11-01", end_date: "2026-11-30" }];
        } },
        Promotions: { findAll: async () => { queried.push("Promotions"); return [{ id: 7, name: "DB promotion", slug_url: "db-promo", banner_url: "image.jpg" }]; } },
        Channels: { findAll: async () => { queried.push("Channels"); return [{ code: "TEST", name: "DB channel" }]; } },
    };
    const controller = loadModule("controllers/promotionsController.js", {
        "../models": { getDBModelContext: () => ({ sequelize: { escape: () => "'DB_TIME'" }, models: dbModels }) },
        "../config/envConfig": { r2: { publicBaseUrl: "https://assets.example" } },
        "../utils/nzTimeZone": time, "../utils/apiResponse": responses,
    });
    const res = {};
    await controller.getCurrentPromotions({}, res, (error) => { throw error; });
    assert.deepEqual(queried.sort(), ["Channels", "Promotion_Channels", "Promotions"]);
    assert.equal(res.data[0].title, "DB promotion");
    assert.equal(res.data[0].channels[0].names[0], "DB channel");
});

test("GET current events uses DB while GET event form continues to use active DDB", async () => {
    const queries = [];
    const active = {
        Events: { findOne: async (options) => {
            queries.push("DDB form");
            assert.ok(options.where[Op.and][0].val.includes("DDB_TIME"));
            return { id: 1, slug_url: "dev-event" };
        } },
        Event_Form_Sections: { findAll: async () => [] },
        Event_Form_Uploads: { findAll: async () => [] },
    };
    const controller = loadModule("controllers/eventsController.js", {
        "../models": {
            sequelize: { escape: () => "'DDB_TIME'" }, models: { active },
            getDBModelContext: () => ({ sequelize: { escape: () => "'DB_TIME'" }, models: {
                Events: { findAll: async (options) => {
                    queries.push("DB current");
                    assert.ok(options.where[Op.and][0].val.includes("DB_TIME"));
                    return [{ name: "DB event", banner_url: "image.jpg", slug_url: "db-event" }];
                } },
            } }),
        },
        "../services/eventEligibilityService": {}, "../services/claimFileUploadService": {},
        "../services/eventConfirmationEmailService": {}, "../services/logService": {},
        "../config/envConfig": { r2: { publicBaseUrl: "https://assets.example" } },
        "../utils/nzTimeZone": time, "../utils/apiResponse": responses,
    });
    const current = {};
    await controller.getCurrentEvents({}, current, (error) => { throw error; });
    const form = {};
    await controller.getEventForm({ params: { slug: "dev-event" } }, form, (error) => { throw error; });
    assert.equal(current.data[0].name, "DB event");
    assert.equal(form.data.event.slug_url, "dev-event");
    assert.deepEqual(queries, ["DB current", "DDB form"]);
});

test("DB read failures reach the error handler without changing the data source", async () => {
    const expected = new Error("DB unavailable");
    const controller = loadModule("controllers/promotionsController.js", {
        "../models": { getDBModelContext: () => { throw expected; } },
        "../config/envConfig": { r2: {} }, "../utils/nzTimeZone": time, "../utils/apiResponse": responses,
    });
    let received;
    await controller.getCurrentPromotions({}, {}, (error) => { received = error; });
    assert.equal(received, expected);
    assert.equal(received.status, 500);
});
