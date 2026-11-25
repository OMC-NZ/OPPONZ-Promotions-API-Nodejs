const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Sequelize, DataTypes } = require("sequelize");
const { buildPromotionGiftResponseMap } = require("../utils/promotionGiftResponse");

const gifts = [
    { id: 11, name: "Earbuds", alias: "earbuds-white", color: "White", status: 2, gift_comb: 999 },
    { id: 12, name: "Watch", alias: "watch-black", color: "Black", status: 1 },
];

test("gift_comb is taken from each promotion-gift link, including zero, not the gift catalog", () => {
    const result = buildPromotionGiftResponseMap({
        gifts,
        promotionGifts: [
            { promotion_id: 7, gift_id: 11, gift_comb: 0 },
            { promotion_id: 8, gift_id: 11, gift_comb: 4 },
        ],
    });
    assert.deepEqual(result.get("7"), [{ name: "Earbuds", alias: "earbuds-white", color: "White", status: 2, gift_comb: 0 }]);
    assert.equal(result.get("8")[0].gift_comb, 4);
});

test("response preserves distinct combination links and gift statuses without adding eligibility rules", () => {
    const result = buildPromotionGiftResponseMap({
        gifts,
        promotionGifts: [
            { promotion_id: 7, gift_id: "12", gift_comb: 3 },
            { promotion_id: 7, gift_id: 11, gift_comb: 3 },
            { promotion_id: 7, gift_id: 11, gift_comb: -1 },
            { promotion_id: 7, gift_id: 99, gift_comb: 8 },
        ],
    });
    assert.deepEqual(result.get("7").map((gift) => [gift.alias, gift.gift_comb, gift.status]), [
        ["watch-black", 3, 1], ["earbuds-white", 3, 2], ["earbuds-white", -1, 2],
    ]);
    assert.equal(buildPromotionGiftResponseMap({ gifts, promotionGifts: [] }).size, 0);
});

test("Promotion_Gifts model and API field selection include gift_comb as an integer", async () => {
    const connection = new Sequelize("test", "test", "test", { dialect: "mysql", logging: false });
    try {
        const model = require("../models/tables/Promotion_Gifts")(connection);
        assert.ok(model.rawAttributes.gift_comb.type instanceof DataTypes.INTEGER);
        assert.ok(require("../config/apiFields").Promotion_Gifts.includes("gift_comb"));
    } finally {
        await connection.close();
    }
});
