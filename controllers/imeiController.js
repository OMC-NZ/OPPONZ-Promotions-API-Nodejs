const { Op } = require("sequelize");
const { models } = require("../models");
const { getNewZealandTime, toNewZealandDateTime } = require("../utils/nzTimeZone");
const { sendSuccess } = require("../utils/apiResponse");

const sendIneligibleResult = (req, res) => {
    return sendSuccess(req, res, {
        data: {
            eligible: false,
            reason: "NO_ELIGIBLE_PROMOTION_FOUND",
            message: "No eligible promotion found.",
            promotions: [],
        },
    });
};

const verifyImei = async (req, res, next) => {
    try {
        const { imei, purchase_date: purchaseDateInput } = req.body;
        const requestTime = getNewZealandTime();
        const purchaseDate = toNewZealandDateTime(purchaseDateInput);
        const {
            Devices,
            Promotion_Devices,
            Promotion_Channels,
            Promotions,
        } = models.active;

        const device = await Devices.findOne({
            attributes: ["model", "channel_code", "redemption_status"],
            where: { imei },
            raw: true,
        });

        if (!device) {
            return sendIneligibleResult(req, res);
        }

        if (Number(device.redemption_status) !== 0) {
            return sendIneligibleResult(req, res);
        }

        const promotionDevices = await Promotion_Devices.findAll({
            attributes: ["promotion_id"],
            where: {
                eligible_model: device.model,
            },
            raw: true,
        });

        const modelPromotionIds = [...new Set(promotionDevices.map((item) => item.promotion_id))];

        if (modelPromotionIds.length === 0) {
            return sendIneligibleResult(req, res);
        }

        const promotionChannels = await Promotion_Channels.findAll({
            attributes: ["promotion_id"],
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
            raw: true,
        });

        const eligiblePromotionIds = [
            ...new Set(promotionChannels.map((item) => item.promotion_id)),
        ].sort((left, right) => Number(right) - Number(left));

        if (eligiblePromotionIds.length === 0) {
            return sendIneligibleResult(req, res);
        }

        const promotions = await Promotions.findAll({
            attributes: ["id", "name", "description", "banner_url", "slug_url"],
            where: {
                id: {
                    [Op.in]: eligiblePromotionIds,
                },
            },
            raw: true,
        });

        const promotionMap = new Map(promotions.map((item) => [String(item.id), item]));

        const eligiblePromotions = eligiblePromotionIds.flatMap((promotionIdValue) => {
            const promotionId = String(promotionIdValue);
            const promotion = promotionMap.get(promotionId);
            if (!promotion) return [];

            return [{
                promotion_id: promotion.id,
                title: promotion.name,
                description: promotion.description,
                banner_url: promotion.banner_url,
                slug_url: promotion.slug_url,
            }];
        });

        if (eligiblePromotions.length === 0) {
            return sendIneligibleResult(req, res);
        }

        return sendSuccess(req, res, {
            data: {
                eligible: true,
                promotions: eligiblePromotions,
            },
        });
    } catch (error) {
        error.status = 500;
        error.publicMessage = "Failed to verify IMEI.";
        return next(error);
    }
};

module.exports = {
    verifyImei,
};
