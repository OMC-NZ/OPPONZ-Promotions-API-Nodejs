const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadModule } = require("./helpers/loadModule");

test("event submissions persist required delivery addresses in the same transaction", async () => {
    const calls = [];
    const transaction = { commit: async () => calls.push("commit"), rollback: async () => calls.push("rollback") };
    let savedClaim;
    let savedAddress;
    const service = loadModule("controllers/eventsController.js", {
        "../models": { sequelize: { escape: (value) => `'${value}'`, transaction: async () => transaction }, models: { active: {
            Events: { findOne: async () => ({ id: 1, slug_url: "event", requires_imei: 0, requires_channel: 0, requires_delivery: 1 }) },
            Customers: { create: async () => ({ id: 42 }) },
            Event_Claims: { findByPk: async () => null, create: async (values, options) => {
                assert.equal(options.transaction, transaction);
                savedClaim = values;
            } },
            Deliver_Addresses: { create: async (values, options) => {
                assert.equal(options.transaction, transaction);
                savedAddress = values;
            } },
            Event_Form_Sections: { findAll: async () => [] },
            Event_Form_Custom_Fields: {}, Event_Form_Uploads: { findAll: async () => [] },
        } } },
        "../config/envConfig": { r2: {} },
        "../services/claimFileUploadService": { validateClaimFile: () => {} },
        "../services/eventEligibilityService": {},
        "../services/eventConfirmationEmailService": { queueEventConfirmationEmail: () => calls.push("email") },
        "../services/logService": { writeLog: async () => {} },
        "../utils/nzTimeZone": { getNewZealandTime: () => "2026-10-28 12:00:00" },
        "../utils/apiResponse": { sendSuccess: (req, res, options) => Object.assign(res, options) },
    });
    const res = {};
    await service.submitEventClaim({ params: { slug: "event" }, body: {
        first_name: "Test", last_name: "Customer", email: "test@example.com", contact: "0211234567",
        street: "87 Albert Street", suburb: "Auckland Central", city: "Auckland", postcode: "1010",
        extra_data: '{"devices":"watch"}',
    } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 201);
    assert.match(savedClaim.id, /^OPNZEVTCLM-261028-[A-Z0-9]{8}$/);
    assert.equal(savedAddress.event_claim_id, savedClaim.id);
    assert.equal(savedAddress.claim_id, null);
    assert.equal(savedAddress.city, "Auckland");
    assert.deepEqual(calls, ["commit", "email"]);
});

test("shared event eligibility uses two restriction queries and locks before duplicate checks", async () => {
    const order = [];
    let model = "CPH1234";
    const transaction = {};
    const service = loadModule("services/eventEligibilityService.js", {
        "../models": { models: { active: {
            Devices: { findOne: async (options) => {
                assert.equal(options.lock, true);
                assert.equal(options.transaction, transaction);
                order.push("device");
                return { model, channel_code: "TEST" };
            } },
            Event_Claims: { findOne: async () => { order.push("claim"); return null; } },
            Event_Channels: { findAll: async () => { order.push("channels"); return [{ channel_code: "TEST" }]; } },
            Event_Models: { findAll: async () => { order.push("models"); return [{ eligible_model: "CPH1234" }]; } },
        } } },
    });
    const options = { event: { id: 1, requires_channel: 1 }, imei: "864265082387394", transaction, lockDevice: true };
    assert.equal((await service.getEventDeviceVerification(options)).verified, true);
    assert.deepEqual(order, ["device", "claim", "channels", "models"]);
    model = "CPH9999";
    assert.equal((await service.getEventDeviceVerification(options)).verified, false);
});

test("scratch codes are assigned under claim and code row locks, then reused on resend", async () => {
    const locks = [];
    const messages = [];
    let assigned = false;
    const transaction = {};
    const code = { td_code: "TEST-CODE", update: async (values, options) => {
        assert.equal(options.transaction, transaction);
        assigned = true;
    } };
    const service = loadModule("services/eventConfirmationEmailService.js", {
        "../config/envConfig": { r2: { publicBaseUrl: "https://assets.example" }, email: { from: "test@example.com" } },
        "../models": { sequelize: { transaction: async (callback) => callback(transaction) }, models: { active: {
            Event_Claims: { findByPk: async (id, options) => { locks.push(options.lock); return { id }; } },
            TD_Scratch_Codes: { findOne: async (options) => {
                if (options.where.event_claim_id === "claim-1") return assigned ? code : null;
                locks.push(options.lock);
                return code;
            } },
        } } },
        "./mailService": { isEmailConfigured: () => true, getTransporter: () => ({ sendMail: async (mail) => messages.push(mail) }) },
        "../utils/httpJson": { requestJson: async () => ({ subject: "Code", body: ["{{td_scratch_codes.td_code}}"] }) },
        "./logService": { writeLog: async () => {} },
    });
    const options = { slugUrl: "2degrees-bonus", eventClaimId: "claim-1", fullName: "Test", recipientEmail: "test@example.com" };
    await service.sendEventConfirmationEmail(options);
    await service.sendEventConfirmationEmail(options);
    assert.deepEqual(locks, [true, true, true]);
    assert.ok(messages.every((mail) => mail.text === "TEST-CODE"));
});

test("logging reuses directories, serializes concurrent file appends, and flushes pending writes", async () => {
    let directories = 0;
    let writing = false;
    const lines = [];
    const service = loadModule("services/logService.js", {
        "../config/envConfig": { logs: { directory: "logs", retentionDays: 21 } },
        "../utils/nzTimeZone": { getNewZealandTime: () => "2026-10-28 12:00:00" },
        "fs/promises": {
            mkdir: async () => { directories += 1; },
            appendFile: async (file, line) => {
                assert.equal(writing, false);
                writing = true;
                await new Promise(setImmediate);
                lines.push(line);
                writing = false;
            },
        },
    }, { __dirname: require("node:path").resolve(__dirname, "../services") });
    for (let i = 0; i < 10; i += 1) service.writeLog("request", { id: i, token: "private" });
    await service.flushLogs();
    assert.equal(directories, 1);
    assert.equal(lines.length, 10);
    assert.ok(lines.every((line) => line.startsWith("2026-10-28 12:00:00 ") && !line.includes("private")));
});
