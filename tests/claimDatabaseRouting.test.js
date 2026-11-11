const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Op } = require("sequelize");
const { loadModule } = require("./helpers/loadModule");

const time = {
    getNewZealandTime: () => "2026-11-11 12:00:00",
    toNewZealandDateTime: () => "2026-11-01 00:00:00",
};
const giftAliases = ["earbuds-white", "watch-black"];

const claimHarness = ({ production = false, missingGift = false, unlinkedGift = false, failDB = false } = {}) => {
    const reads = [];
    const writes = [];
    const uploads = [];
    const transaction = {
        commit: async () => writes.push({ table: "commit" }),
        rollback: async () => writes.push({ table: "rollback" }),
    };
    const device = { model: "CPH1234", channel_code: "TEST", redemption_status: 0 };
    const destinationGifts = [
        { id: 11, alias: giftAliases[0], name: "Earbuds", color: "White" },
        { id: 12, alias: giftAliases[1], name: "Watch", color: "Black" },
    ];
    const recordWrite = (table, result) => async (values, options) => {
        assert.equal(options.transaction, transaction);
        writes.push({ table, values });
        return result;
    };
    const activeSequelize = {
        transaction: async () => { writes.push({ table: "begin" }); return transaction; },
        escape: () => "'ACTIVE_TIME'",
    };
    const active = {
        Customers: { create: recordWrite("Customers", { id: 42 }) },
        Claims: { findByPk: async () => null, create: recordWrite("Claims") },
        Deliver_Addresses: { create: recordWrite("Deliver_Addresses") },
        Claim_Gifts: { bulkCreate: recordWrite("Claim_Gifts") },
        Devices: {
            findOne: async (options) => { reads.push({ table: "destination Devices", options }); return device; },
            findByPk: async (imei, options) => {
                assert.equal(options.transaction, transaction);
                assert.equal(options.lock, true);
                return { ...device, update: recordWrite("Devices") };
            },
        },
        Gifts: { findAll: async (options) => {
            reads.push({ table: "destination Gifts", options });
            return missingGift ? destinationGifts.slice(0, 1) : destinationGifts;
        } },
    };
    const catalogGifts = production ? destinationGifts : destinationGifts.map((gift) => ({ ...gift, id: gift.id + 100 }));
    const dbRead = (table, result) => async (...args) => {
        const options = table === "Promotions" ? args[1] : args[0];
        reads.push({ table, options });
        if (failDB && table === "Promotions") throw new Error("DB unavailable");
        return result;
    };
    const dbModels = {
        Promotions: { findByPk: dbRead("Promotions", { id: 7 }) },
        Promotion_Devices: { findAll: dbRead("Promotion_Devices", [{ promotion_id: 7 }]) },
        Promotion_Channels: { findAll: dbRead("Promotion_Channels", [{ promotion_id: 7 }]) },
        Promotion_Gifts: { findAll: dbRead("Promotion_Gifts", catalogGifts.slice(0, unlinkedGift ? 1 : 2).map((gift) => ({ gift_id: gift.id }))) },
        Gifts: { findAll: dbRead("catalog Gifts", catalogGifts) },
    };
    const dbContext = production
        ? { sequelize: activeSequelize, models: Object.assign(active, { ...dbModels, Gifts: active.Gifts }) }
        : { sequelize: { escape: () => "'DB_TIME'", transaction: () => assert.fail("No DB write transaction in development") }, models: dbModels };
    const modelModule = { sequelize: activeSequelize, models: { active }, getDBModelContext: () => dbContext };
    const service = loadModule("services/promotionEligibilityService.js", {
        "../models": modelModule, "../utils/nzTimeZone": time,
    });
    const controller = loadModule("controllers/claimsController.js", {
        "../models": modelModule,
        "../services/promotionEligibilityService": service,
        "../services/claimConfirmationEmailService": {
            EMAIL_STATUS_FAILED: 0, queueClaimConfirmationEmail: () => writes.push({ table: "email" }),
        },
        "../services/claimFileUploadService": {
            validateClaimFile: () => {},
            uploadClaimFile: async (options) => { uploads.push(options); return { file_name: "uuid.jpg" }; },
        },
        "../utils/nzTimeZone": time,
        "../utils/apiResponse": {
            sendError: (req, res, options) => Object.assign(res, options),
            sendSuccess: (req, res, options) => Object.assign(res, options),
        },
    });
    const req = {
        body: {
            promotion_id: 7, imei: "860000000000000", purchase_date: "2026-11-01",
            invoicenumber: "INV-123", gift_alias: giftAliases,
            first_name: "Test", last_name: "Customer", email: "test@example.com", contact: "0211234567",
            street: "87 Albert Street", suburb: "Auckland Central", city: "Auckland", postcode: "1010",
        },
        files: { receipt: [{}], screenshot: [{}] },
    };
    const submit = async () => {
        const res = {};
        let error;
        await controller.submitClaim(req, res, (value) => { error = value; });
        return { res, error };
    };
    return { reads, writes, uploads, transaction, service, dbContext, submit };
};

test("development claims read DB promotion configuration but write only active DDB models", async () => {
    const { reads, writes, uploads, submit } = claimHarness();
    const { res, error } = await submit();
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(reads.map((item) => item.table).sort(), [
        "Promotion_Channels", "Promotion_Devices", "Promotion_Gifts", "Promotions", "catalog Gifts", "destination Devices", "destination Gifts",
    ]);
    assert.deepEqual(reads.find((item) => item.table === "Promotion_Gifts").options.where.gift_id[Op.in], [111, 112]);
    assert.deepEqual(writes.map((item) => item.table), ["begin", "Customers", "Claims", "Deliver_Addresses", "Claim_Gifts", "Devices", "commit", "email"]);
    assert.equal(writes.find((item) => item.table === "Claims").values.promotion_id, 7);
    assert.deepEqual(writes.find((item) => item.table === "Claim_Gifts").values.map((item) => item.gift_id), [11, 12]);
    assert.equal(uploads.length, 2);
    assert.ok(uploads.every((item) => item.slug === 7 && item.claimType === "promotions"));
});

test("DDB transactions are never passed to promotion reads on the separate DB connection", async () => {
    const { service, reads, transaction, dbContext } = claimHarness();
    const result = await service.checkPromotionEligibility({
        imei: "860000000000000", promotionId: 7, purchaseDateInput: "2026-11-01",
        giftAliases, transaction, promotionContext: dbContext,
    });
    assert.equal(result.eligible, true);
    for (const read of reads) {
        assert.equal(read.options.transaction, read.table.startsWith("destination ") ? transaction : undefined);
    }
    const conditions = reads.find((item) => item.table === "Promotion_Channels").options.where[Op.and];
    assert.ok(conditions.every((condition) => condition.val.includes("DB_TIME")));
});

test("production claims keep the same DB transaction and do not query the gift catalog twice", async () => {
    const { service, reads, transaction, dbContext } = claimHarness({ production: true });
    const result = await service.checkPromotionEligibility({
        imei: "860000000000000", promotionId: 7, purchaseDateInput: "2026-11-01",
        giftAliases, transaction, promotionContext: dbContext,
    });
    assert.equal(result.eligible, true);
    assert.ok(reads.every((read) => read.options.transaction === transaction));
    assert.equal(reads.filter((read) => read.table.includes("Gifts") && !read.table.includes("Promotion_")).length, 1);
});

test("production submissions still save customers, claims, addresses and gifts through active DB", async () => {
    const { writes, submit } = claimHarness({ production: true });
    const { res, error } = await submit();
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(writes.map((item) => item.table), ["begin", "Customers", "Claims", "Deliver_Addresses", "Claim_Gifts", "Devices", "commit", "email"]);
});

test("missing destination gifts and unlinked DB gifts stop before upload or writes", async () => {
    for (const [options, reason] of [
        [{ missingGift: true }, "GIFT_NOT_FOUND"],
        [{ unlinkedGift: true }, "GIFT_NOT_LINKED_TO_PROMOTION"],
    ]) {
        const { writes, uploads, submit } = claimHarness(options);
        const { res } = await submit();
        assert.equal(res.statusCode, 400);
        assert.equal(res.debug.reason, reason);
        assert.deepEqual(writes, []);
        assert.deepEqual(uploads, []);
    }
});

test("DB read failure never falls back to DDB promotion data or starts writes", async () => {
    const { writes, uploads, submit } = claimHarness({ failDB: true });
    const { error } = await submit();
    assert.equal(error.message, "DB unavailable");
    assert.deepEqual(writes, []);
    assert.deepEqual(uploads, []);
});
