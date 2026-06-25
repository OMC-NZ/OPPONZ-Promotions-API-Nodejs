const { Op } = require("sequelize");
const { models } = require("../models");
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

    const promotionChannels = await Promotion_Channels.findAll({
        attributes: ["promotion_id", "channel_code", "start_date", "end_date", "redeem_end_date"],
        where: {
            promotion_id: {
                [Op.in]: modelPromotionIds,
            },
            channel_code: device.channel_code,
            [Op.and]: [
                {
                    start_date: {
                        [Op.lte]: purchaseDate,
                    },
                },
                {
                    end_date: {
                        [Op.gte]: purchaseDate,
                    },
                },
                {
                    start_date: {
                        [Op.lte]: requestTime,
                    },
                },
                {
                    redeem_end_date: {
                        [Op.gte]: requestTime,
                    },
                },
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
    giftAlias,
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

    const [promotion, device, gift] = await Promise.all([
        Promotions.findByPk(promotionId, { transaction }),
        Devices.findOne({
            where: { imei },
            transaction,
        }),
        Gifts.findOne({
            where: { alias: giftAlias },
            transaction,
        }),
    ]);

    if (!promotion || !device || !gift) {
        return {
            eligible: false,
            reason: "NO_ELIGIBLE_PROMOTION_FOUND",
            promotion,
            device,
            gift,
        };
    }

    if (Number(device.redemption_status) !== DEVICE_REDEMPTION_STATUS_AVAILABLE) {
        return {
            eligible: false,
            reason: "NO_ELIGIBLE_PROMOTION_FOUND",
            promotion,
            device,
            gift,
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
            reason: "NO_ELIGIBLE_PROMOTION_FOUND",
            promotion,
            device,
            gift,
        };
    }

    const promotionGift = await Promotion_Gifts.findOne({
        where: {
            promotion_id: promotionId,
            gift_id: gift.id,
        },
        transaction,
    });

    if (!promotionGift) {
        return {
            eligible: false,
            reason: "NO_ELIGIBLE_PROMOTION_FOUND",
            promotion,
            device,
            gift,
        };
    }

    return {
        eligible: true,
        promotion,
        device,
        gift,
        promotionGift,
        eligiblePromotionIds,
        purchaseDate,
        requestTime,
    };
};

module.exports = {
    checkPromotionEligibility,
    findEligiblePromotionIdsForDevice,
};
