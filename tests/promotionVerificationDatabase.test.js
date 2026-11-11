const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Op } = require("sequelize");
const { loadModule } = require("./helpers/loadModule");

const time = {
    getNewZealandTime: () => "2026-11-11 12:00:00",
    toNewZealandDateTime: () => "2026-11-01 00:00:00",
};
const responses = { sendSuccess: (req, res, options) => Object.assign(res, options) };

const verificationHarness = ({ deviceFound = true, redemptionStatus = 0 } = {}) => {
    const queried = [];
    const dbModels = {
        Devices: { findOne: async (options) => {
            queried.push("Devices");
            assert.equal(options.where.imei, "860000000000000");
            return deviceFound ? { model: "CPH1234", channel_code: "TEST", redemption_status: redemptionStatus } : null;
        } },
        Promotion_Devices: { findAll: async (options) => {
            queried.push("Promotion_Devices");
            assert.equal(options.where.eligible_model, "CPH1234");
            return [{ promotion_id: 7 }];
        } },
        Promotion_Channels: { findAll: async (options) => {
            queried.push("Promotion_Channels");
            assert.equal(options.where.channel_code, "TEST");
            assert.ok(options.where[Op.and].every((condition) => condition.val.includes("DB_TIME")));
            return [{ promotion_id: 7, channel_code: "TEST", start_date: "01 Nov 2026", end_date: "30 Nov 2026" }];
        } },
        Promotions: { findAll: async () => {
            queried.push("Promotions");
            return [{ id: 7, name: "DB promotion", slug_url: "db-promo", banner_url: "image.jpg", description: "DB offer", terms_url: "terms.pdf" }];
        } },
        Promotion_Gifts: { findAll: async () => { queried.push("Promotion_Gifts"); return [{ promotion_id: 7, gift_id: 11 }]; } },
        Channels: { findAll: async () => { queried.push("Channels"); return [{ code: "TEST", name: "DB channel" }]; } },
        Gifts: { findAll: async () => {
            queried.push("Gifts");
            return [{ id: 11, name: "Earbuds", alias: "earbuds-white", color: "White", status: 2 }];
        } },
    };
    const context = { sequelize: { escape: () => "'DB_TIME'" }, models: dbModels };
    const modelModule = {
        sequelize: { escape: () => assert.fail("The DB verification endpoint must not use the active DDB connection") },
        models: { active: new Proxy({}, { get: () => assert.fail("The DB verification endpoint must not use active DDB models") }) },
        getDBModelContext: () => context,
    };
    const eligibility = loadModule("services/promotionEligibilityService.js", {
        "../models": modelModule, "../utils/nzTimeZone": time,
    });
    const controller = loadModule("controllers/imeiController.js", {
        "../models": modelModule,
        "../services/promotionEligibilityService": eligibility,
        "../services/eventEligibilityService": {},
        "../config/envConfig": { r2: { publicBaseUrl: "https://assets.example" } },
        "../utils/nzTimeZone": time, "../utils/apiResponse": responses,
    });
    return { controller, queried };
};

test("promotion IMEI/purchase verification reads all seven tables through the DB context", async () => {
    const { controller, queried } = verificationHarness();
    const res = {};
    await controller.verifyImei({ body: { imei: "860000000000000", purchase_date: "2026-11-01" } }, res, (error) => { throw error; });
    assert.deepEqual(queried.sort(), ["Channels", "Devices", "Gifts", "Promotion_Channels", "Promotion_Devices", "Promotion_Gifts", "Promotions"]);
    assert.equal(res.data.eligible, true);
    assert.equal(res.data.promotions[0].title, "DB promotion");
    assert.deepEqual(res.data.promotions[0].channel, { name: "DB channel", period: "01 Nov 2026 - 30 Nov 2026" });
    assert.deepEqual(res.data.promotions[0].gifts, [{ name: "Earbuds", alias: "earbuds-white", color: "White", status: 2 }]);
});

test("missing or redeemed devices in DB retain the ineligible response without a DDB fallback", async () => {
    for (const options of [{ deviceFound: false }, { redemptionStatus: 1 }]) {
        const { controller, queried } = verificationHarness(options);
        const res = {};
        await controller.verifyImei({ body: { imei: "860000000000000", purchase_date: "2026-11-01" } }, res, (error) => { throw error; });
        assert.equal(res.data.eligible, false);
        assert.deepEqual(res.data.promotions, []);
        assert.deepEqual(queried, ["Devices"]);
    }
});

test("shared eligibility lookup retains active database routing when no DB context is supplied", async () => {
    const queried = [];
    const service = loadModule("services/promotionEligibilityService.js", {
        "../models": {
            sequelize: { escape: () => "'DDB_TIME'" },
            models: { active: {
                Promotion_Devices: { findAll: async () => { queried.push("DDB models"); return [{ promotion_id: 5 }]; } },
                Promotion_Channels: { findAll: async (options) => {
                    queried.push("DDB channels");
                    assert.ok(options.where[Op.and].every((condition) => condition.val.includes("DDB_TIME")));
                    return [{ promotion_id: 5 }];
                } },
            } },
        },
        "../utils/nzTimeZone": time,
    });
    const ids = await service.findEligiblePromotionIdsForDevice({
        device: { model: "CPH1234", channel_code: "TEST" }, purchaseDate: "2026-11-01 00:00:00", requestTime: time.getNewZealandTime(),
    });
    assert.deepEqual(ids, [5]);
    assert.deepEqual(queried, ["DDB models", "DDB channels"]);
});

test("event IMEI/channel verification continues to use active models", async () => {
    let activeQueried = false;
    const controller = loadModule("controllers/imeiController.js", {
        "../models": {
            models: { active: { Events: { findOne: async () => { activeQueried = true; return { id: 5 }; } } } },
            getDBModelContext: () => assert.fail("Event IMEI verification must keep its existing database routing"),
        },
        "../services/promotionEligibilityService": {},
        "../services/eventEligibilityService": { getEventDeviceVerification: async () => ({ verified: true }) },
        "../config/envConfig": { r2: {} }, "../utils/nzTimeZone": time, "../utils/apiResponse": responses,
    });
    const res = {};
    await controller.verifyImeiChannel({ body: { imei: "860000000000000", slug_url: "dev-event" } }, res, (error) => { throw error; });
    assert.equal(activeQueried, true);
    assert.equal(res.data.verified, true);
});
