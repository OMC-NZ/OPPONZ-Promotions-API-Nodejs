const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const { Op } = require("sequelize");

// Load application modules with isolated database, upload, and email dependencies.
const loadModule = (relativePath, mocks) => {
    const filename = path.resolve(__dirname, "..", relativePath);
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    const wrapper = vm.runInThisContext(
        `(function(require, module, exports) {\n${readFileSync(filename, "utf8")}\n})`,
        { filename }
    );
    wrapper((name) => Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name), module, module.exports);
    return module.exports;
};

const now = "2026-10-23 12:00:00";
const time = { getNewZealandTime: () => now, toNewZealandDateTime: () => now };
const gifts = [
    { id: 11, alias: "earbuds-white", name: "Earbuds", color: "White" },
    { id: 12, alias: "watch-black", name: "Watch", color: "Black" },
];
const aliases = gifts.map((gift) => gift.alias);

test("gift_alias accepts arrays and multipart JSON arrays, including one gift", () => {
    const { giftAliases } = loadModule("utils/validators.js", {
        "../config/securityFeatureConfig": { isStrictProductionSecurity: () => false },
    });
    for (const input of [aliases, JSON.stringify(aliases), [aliases[0]], JSON.stringify([aliases[0]])]) {
        const result = giftAliases().validate(input);
        assert.equal(result.valid, true);
        assert.deepEqual(result.value, typeof input === "string" ? JSON.parse(input) : input);
    }
});

test("gift_alias rejects missing, malformed, empty, duplicate, and non-string selections", () => {
    const { giftAliases } = loadModule("utils/validators.js", {
        "../config/securityFeatureConfig": { isStrictProductionSecurity: () => false },
    });
    const invalid = [
        undefined, null, "", [], "[]", aliases[0], JSON.stringify(aliases[0]),
        aliases.join(","), {}, Object.create(null), [null], [1], [[aliases[0]]],
        [""], ["   "], ["a".repeat(46)], [aliases[0], aliases[0]],
        JSON.stringify([aliases[0], aliases[0]]),
    ];
    for (const input of invalid) assert.equal(giftAliases().validate(input).valid, false);
});

const checkEligibility = async ({ availableGifts = gifts, linkedGifts = gifts, redemptionStatus = 0 } = {}) => {
    const transaction = {};
    const active = {
        Promotions: { findByPk: async () => ({ id: 7 }) },
        Devices: { findOne: async () => ({ model: "CPH1234", channel_code: "TEST", redemption_status: redemptionStatus }) },
        Gifts: { findAll: async (options) => {
            assert.deepEqual(options.where.alias[Op.in], aliases);
            assert.equal(options.transaction, transaction);
            return [...availableGifts].reverse();
        } },
        Promotion_Devices: { findAll: async () => [{ promotion_id: 7 }] },
        Promotion_Channels: { findAll: async () => [{ promotion_id: 7 }] },
        Promotion_Gifts: { findAll: async (options) => {
            assert.deepEqual(options.where.gift_id[Op.in], [11, 12]);
            assert.equal(options.where.promotion_id, 7);
            assert.equal(options.transaction, transaction);
            return linkedGifts.map((gift) => ({ gift_id: gift.id }));
        } },
    };
    const service = loadModule("services/promotionEligibilityService.js", {
        "../models": { models: { active }, sequelize: { escape: (value) => `'${value}'` } },
        "../utils/nzTimeZone": time,
    });
    return service.checkPromotionEligibility({
        imei: "864265082387394", purchaseDateInput: "2026-10-23",
        promotionId: 7, giftAliases: aliases, transaction,
    });
};

test("eligibility validates every gift and preserves the selected order", async () => {
    const result = await checkEligibility();
    assert.equal(result.eligible, true);
    assert.deepEqual(result.gifts.map((gift) => gift.alias), aliases);
});

test("eligibility rejects a missing gift or a gift outside the promotion", async () => {
    const missing = await checkEligibility({ availableGifts: gifts.slice(0, 1) });
    assert.equal(missing.reason, "GIFT_NOT_FOUND");
    assert.deepEqual(missing.missingGiftAliases, ["watch-black"]);
    const unlinked = await checkEligibility({ linkedGifts: gifts.slice(0, 1) });
    assert.equal(unlinked.reason, "GIFT_NOT_LINKED_TO_PROMOTION");
    assert.deepEqual(unlinked.unlinkedGiftAliases, ["watch-black"]);
    assert.equal((await checkEligibility({ redemptionStatus: 1 })).reason, "DEVICE_ALREADY_REDEEMED");
});

const submitClaim = async ({ eligible = true, failInsert = false } = {}) => {
    const calls = [];
    const transaction = {
        commit: async () => calls.push("commit"),
        rollback: async () => calls.push("rollback"),
    };
    const create = (name, result) => async (values, options) => {
        assert.equal(options.transaction, transaction);
        calls.push({ name, values });
        if (name === "gifts" && failInsert) throw new Error("Gift insert failed");
        return result;
    };
    const active = {
        Customers: { create: create("customer", { id: 42 }) },
        Claims: { findByPk: async () => null, create: create("claim") },
        Deliver_Addresses: { create: create("address") },
        Claim_Gifts: { bulkCreate: create("gifts") },
    };
    const controller = loadModule("controllers/claimsController.js", {
        "../models": { models: { active }, sequelize: { transaction: async () => transaction } },
        "../services/claimConfirmationEmailService": {
            EMAIL_STATUS_FAILED: 0,
            queueClaimConfirmationEmail: () => calls.push("email"),
        },
        "../services/promotionEligibilityService": { checkPromotionEligibility: async (options) => {
            assert.deepEqual(options.giftAliases, aliases);
            return {
                eligible, gifts, promotion: { id: 7 }, reason: eligible ? undefined : "GIFT_NOT_LINKED_TO_PROMOTION",
                device: { update: create("device") },
            };
        } },
        "../services/claimFileUploadService": {
            validateClaimFile: () => {},
            uploadClaimFile: async () => { calls.push("upload"); return { file_name: "uploaded.jpg" }; },
        },
        "../utils/nzTimeZone": time,
        "../utils/apiResponse": {
            sendError: (req, res, options) => Object.assign(res, options),
            sendSuccess: (req, res, options) => Object.assign(res, options),
        },
    });
    const req = {
        body: {
            promotion_id: 7, imei: "864265082387394", purchase_date: "2026-10-23",
            invoicenumber: "INV-123", gift_alias: aliases, first_name: "Test", last_name: "Customer",
            email: "test@example.com", contact: "0211234567", street: "87 Albert Street",
            suburb: "Auckland Central", city: "Auckland", postcode: "1010",
        },
        files: { receipt: [{}], screenshot: [{}] },
    };
    const res = {};
    let error;
    await controller.submitClaim(req, res, (value) => { error = value; });
    return { calls, res, error };
};

test("submission saves both gift links in the claim transaction before sending email", async () => {
    const { calls, res, error } = await submitClaim();
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.gift, "Earbuds White, Watch Black");
    assert.deepEqual(calls.find((call) => call.name === "gifts").values, [
        { claim_id: res.data.claim_id, gift_id: 11 },
        { claim_id: res.data.claim_id, gift_id: 12 },
    ]);
    assert.equal(calls.filter((call) => call.name === "customer").length, 1);
    assert.equal(calls.filter((call) => call.name === "claim").length, 1);
    assert.deepEqual(calls.slice(-2), ["commit", "email"]);
});

test("invalid gifts stop submission before upload or database writes", async () => {
    const { calls, res } = await submitClaim({ eligible: false });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(calls, ["rollback"]);
});

test("gift link insert failure rolls back and does not send confirmation email", async () => {
    const { calls, error } = await submitClaim({ failInsert: true });
    assert.equal(error.message, "Gift insert failed");
    assert.equal(calls.at(-1), "rollback");
    assert.equal(calls.includes("commit"), false);
    assert.equal(calls.includes("email"), false);
});

test("confirmation email includes every saved gift in HTML and plain text", async () => {
    let mail;
    const service = loadModule("services/claimConfirmationEmailService.js", {
        nodemailer: { createTransport: () => ({ sendMail: async (value) => { mail = value; } }) },
        "../config/envConfig": { email: {
            host: "smtp.example.com", port: 587, user: "test", pass: "test",
            from: "test@example.com", trackingUrl: "https://example.com", serviceEmail: "test@example.com",
        } },
        "../models": { models: { active: {
            Claims: { findByPk: async () => ({ customer_id: 42 }), update: async () => {} },
            Customers: { findByPk: async () => ({ first_name: "Test", email: "test@example.com" }) },
            Deliver_Addresses: { findOne: async () => ({ street: "87 Albert Street" }) },
            Claim_Gifts: { findAll: async (options) => {
                assert.equal(options.include[0].as, "gift");
                return gifts.map((gift) => ({ gift }));
            } },
            Gifts: {},
        } } },
        "../utils/nzTimeZone": time,
        "./logService": { writeLog: async () => {} },
    });
    assert.equal(await service.sendClaimConfirmationEmail("test-claim"), true);
    for (const body of [mail.text, mail.html]) {
        assert.ok(body.includes("Earbuds White, Watch Black"));
    }
});
