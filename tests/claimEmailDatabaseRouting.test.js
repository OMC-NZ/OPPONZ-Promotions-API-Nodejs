const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Op } = require("sequelize");
const { loadModule } = require("./helpers/loadModule");

const emailHarness = ({ environment = "development", localProductionTest = false, environmentFileName = ".env.production", failGifts = false } = {}) => {
    const useDevelopmentDatabase = environment === "development" || (localProductionTest && environmentFileName === ".env.test.prod");
    const reads = [];
    const updates = [];
    const messages = [];
    const gifts = [
        { id: 111, name: "Earbuds", color: "White" },
        { id: 112, name: "Watch", color: "Black" },
    ];
    const activeGifts = {};
    const active = {
        Claims: {
            findByPk: async () => ({ customer_id: 42, email_status: 0 }),
            update: async (values, options) => { updates.push(values); assert.equal(options.where.id, "test-claim"); },
        },
        Customers: { findByPk: async () => ({ first_name: "Test", email: "test@example.com" }) },
        Deliver_Addresses: { findOne: async () => ({ street: "87 Albert Street" }) },
        Claim_Gifts: { findAll: async (options) => {
            reads.push("active Claim_Gifts");
            assert.equal(options.where.claim_id, "test-claim");
            assert.deepEqual(options.order, [["id", "ASC"]]);
            if (useDevelopmentDatabase) {
                assert.equal(options.include, undefined, "DDB gift links must not join DDB Gifts");
                return [{ gift_id: 112 }, { gift_id: 111 }];
            }
            assert.equal(options.include[0].model, activeGifts);
            assert.equal(options.include[0].as, "gift");
            return [{ gift: gifts[1] }, { gift: gifts[0] }];
        } },
        get Gifts() {
            assert.equal(useDevelopmentDatabase, false, "Development-database confirmation emails must not use DDB Gifts");
            return activeGifts;
        },
    };
    const service = loadModule("services/claimConfirmationEmailService.js", {
        "../models": {
            models: { active },
            getDBModelContext: () => {
                assert.equal(useDevelopmentDatabase, true, "Production retains its existing single-connection join");
                return { models: { Gifts: { findAll: async (options) => {
                    reads.push("DB Gifts");
                    assert.deepEqual(options.where.id[Op.in], [112, 111]);
                    if (failGifts) throw new Error("DB gifts unavailable");
                    return gifts;
                } } } };
            },
        },
        "./mailService": {
            isEmailConfigured: () => true,
            getTransporter: () => ({ sendMail: async (message) => messages.push(message) }),
        },
        "../config/envConfig": {
            environment, useDevelopmentDatabase, app: { localProductionTest },
            email: { from: "test@example.com", trackingUrl: "https://example.com", serviceEmail: "test@example.com" },
        },
        "../utils/nzTimeZone": { getNewZealandTime: () => "2026-11-18 12:00:00" },
        "./logService": { writeLog: async () => {} },
    });
    return { service, reads, updates, messages };
};

test("development and dev:prod-env email load DB gift details and update status in DDB", async () => {
    for (const options of [{}, { environment: "production", localProductionTest: true, environmentFileName: ".env.test.prod" }]) {
        const { service, reads, updates, messages } = emailHarness(options);
        assert.equal(await service.sendClaimConfirmationEmail("test-claim"), true);
        assert.deepEqual(reads, ["active Claim_Gifts", "DB Gifts"]);
        assert.equal(updates[0].email_status, 1);
        for (const body of [messages[0].html, messages[0].text]) {
            assert.ok(body.includes("Watch Black, Earbuds White"));
        }
    }
});

test("production email retains its DB gift join even if only the local flag is set", async () => {
    for (const localProductionTest of [false, true]) {
        const { service, reads, updates, messages } = emailHarness({ environment: "production", localProductionTest });
        assert.equal(await service.sendClaimConfirmationEmail("test-claim"), true);
        assert.deepEqual(reads, ["active Claim_Gifts"]);
        assert.equal(updates[0].email_status, 1);
        assert.ok(messages[0].text.includes("Watch Black, Earbuds White"));
    }
});

test("failed DB gift lookup does not fall back to DDB Gifts or send misleading confirmation", async () => {
    const { service, reads, updates, messages } = emailHarness({ failGifts: true });
    await assert.rejects(service.sendClaimConfirmationEmail("test-claim"), /DB gifts unavailable/);
    assert.deepEqual(reads, ["active Claim_Gifts", "DB Gifts"]);
    assert.deepEqual(updates, []);
    assert.deepEqual(messages, []);
});
