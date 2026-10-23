const { Op, literal } = require("sequelize");
const { sequelize, models } = require("../models");
const { getNewZealandTime, toNewZealandDateTime } = require("../utils/nzTimeZone");

const DEVICE_REDEMPTION_STATUS_AVAILABLE = 0;

const findEligiblePromotionIdsForDevice = async ({
    device,
    purchaseDate,
    requestTime,
    transaction,
}) => {
    const {
        Promotion_Devices,
        Promotion_Channels,
    } = models.active;

    const promotionDevices = await Promotion_Devices.findAll({
        attributes: ["promotion_id"],
        where: {
            eligible_model: device.model,
        },
        transaction,
        raw: true,
    });

    const modelPromotionIds = [...new Set(promotionDevices.map((item) => item.promotion_id))];

    if (modelPromotionIds.length === 0) return [];

    const purchaseDateLiteral = sequelize.escape(purchaseDate);
    const requestTimeLiteral = sequelize.escape(requestTime);

    const promotionChannels = await Promotion_Channels.findAll({
        attributes: ["promotion_id", "channel_code", "start_date", "end_date", "redeem_end_date"],
        where: {
            promotion_id: {
                [Op.in]: modelPromotionIds,
            },
            channel_code: device.channel_code,
            [Op.and]: [
                literal(`start_date <= ${purchaseDateLiteral}`),
                literal(`end_date >= ${purchaseDateLiteral}`),
                literal(`start_date <= ${requestTimeLiteral}`),
                literal(`redeem_end_date >= ${requestTimeLiteral}`),
            ],
        },
        transaction,
        raw: true,
    });

    return [...new Set(promotionChannels.map((item) => item.promotion_id))]
        .sort((left, right) => Number(right) - Number(left));
};

const checkPromotionEligibility = async ({
    imei,
    purchaseDateInput,
    promotionId,
    giftAliases,
    transaction,
}) => {
    const {
        Devices,
        Gifts,
        Promotions,
        Promotion_Gifts,
    } = models.active;
    const requestTime = getNewZealandTime();
    const purchaseDate = toNewZealandDateTime(purchaseDateInput);

    const [promotion, device, matchingGifts] = await Promise.all([
        Promotions.findByPk(promotionId, { transaction }),
        Devices.findOne({
            where: { imei },
            transaction,
        }),
        Gifts.findAll({
            where: { alias: { [Op.in]: giftAliases } },
            transaction,
        }),
    ]);
    const giftsByAlias = new Map(matchingGifts.map((gift) => [gift.alias, gift]));
    const missingGiftAliases = giftAliases.filter((alias) => !giftsByAlias.has(alias));
    const gifts = giftAliases.filter((alias) => giftsByAlias.has(alias))
        .map((alias) => giftsByAlias.get(alias));

    if (!promotion || !device || missingGiftAliases.length > 0) {
        return {
            eligible: false,
            reason: !promotion
                ? "PROMOTION_NOT_FOUND"
                : !device
                    ? "DEVICE_NOT_FOUND"
                    : "GIFT_NOT_FOUND",
            promotion,
            device,
            gifts,
            missingGiftAliases,
        };
    }

    if (Number(device.redemption_status) !== DEVICE_REDEMPTION_STATUS_AVAILABLE) {
        return {
            eligible: false,
            reason: "DEVICE_ALREADY_REDEEMED",
            promotion,
            device,
            gifts,
        };
    }

    const eligiblePromotionIds = await findEligiblePromotionIdsForDevice({
        device,
        purchaseDate,
        requestTime,
        transaction,
    });
    const promotionIsEligible = eligiblePromotionIds
        .map((item) => String(item))
        .includes(String(promotionId));

    if (!promotionIsEligible) {
        return {
            eligible: false,
            reason: "PROMOTION_NOT_ELIGIBLE_FOR_DEVICE_OR_DATE",
            promotion,
            device,
            gifts,
            eligiblePromotionIds,
            purchaseDate,
            requestTime,
        };
    }

    const promotionGifts = await Promotion_Gifts.findAll({
        where: {
            promotion_id: promotionId,
            gift_id: { [Op.in]: gifts.map((gift) => gift.id) },
        },
        transaction,
    });

    const linkedGiftIds = new Set(promotionGifts.map((item) => item.gift_id));
    const unlinkedGiftAliases = gifts.filter((gift) => !linkedGiftIds.has(gift.id))
        .map((gift) => gift.alias);

    if (unlinkedGiftAliases.length > 0) {
        return {
            eligible: false,
            reason: "GIFT_NOT_LINKED_TO_PROMOTION",
            promotion,
            device,
            gifts,
            unlinkedGiftAliases,
        };
    }

    return {
        eligible: true,
        promotion,
        device,
        gifts,
        promotionGifts,
        eligiblePromotionIds,
        purchaseDate,
        requestTime,
    };
};

module.exports = {
    checkPromotionEligibility,
    findEligiblePromotionIdsForDevice,
};
