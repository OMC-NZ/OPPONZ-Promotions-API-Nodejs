const { Op, fn, col } = require("sequelize");
const { models } = require("../models");
const { findEligiblePromotionIdsForDevice } = require("../services/promotionEligibilityService");
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

const verifyImeiChannel = async (req, res, next) => {
    try {
        const { imei } = req.body;
        const slugUrl = String(req.body.slug_url || "").trim();
        const {
            Devices,
            Events,
            Event_Channels,
            Event_Models,
            Event_Claims,
        } = models.active;

        const [event, device, existingEventClaim] = await Promise.all([
            Events.findOne({
                attributes: ["id"],
                where: { slug_url: slugUrl },
                raw: true,
            }),
            Devices.findOne({
                attributes: ["channel_code", "model"],
                where: { imei },
                raw: true,
            }),
            Event_Claims.findOne({
                attributes: ["id"],
                where: { imei },
                raw: true,
            }),
        ]);

        if (!event || !device || existingEventClaim) {
            return sendSuccess(req, res, {
                data: {
                    verified: false,
                },
            });
        }

        if (!device.channel_code || !device.model) {
            return sendSuccess(req, res, {
                data: {
                    verified: false,
                },
            });
        }

        const [
            hasChannelRestriction,
            matchingEventChannel,
            hasModelRestriction,
            matchingEventModel,
        ] = await Promise.all([
            Event_Channels.findOne({
                attributes: ["id"],
                where: {
                    event_id: event.id,
                },
                raw: true,
            }),
            Event_Channels.findOne({
                attributes: ["id"],
                where: {
                    event_id: event.id,
                    channel_code: device.channel_code,
                },
                raw: true,
            }),
            Event_Models.findOne({
                attributes: ["id"],
                where: {
                    event_id: event.id,
                },
                raw: true,
            }),
            Event_Models.findOne({
                attributes: ["id"],
                where: {
                    event_id: event.id,
                    eligible_model: device.model,
                },
                raw: true,
            }),
        ]);

        const channelVerified = !hasChannelRestriction || Boolean(matchingEventChannel);
        const modelVerified = !hasModelRestriction || Boolean(matchingEventModel);

        return sendSuccess(req, res, {
            data: {
                verified: channelVerified && modelVerified,
            },
        });
    } catch (error) {
        error.status = 500;
        error.publicMessage = "Failed to verify IMEI channel.";
        return next(error);
    }
};

const verifyImei = async (req, res, next) => {
    try {
        const { imei, purchase_date: purchaseDateInput } = req.body;
        const requestTime = getNewZealandTime();
        const purchaseDate = toNewZealandDateTime(purchaseDateInput);
        const {
            Devices,
            Channels,
            Promotion_Channels,
            Promotions,
            Promotion_Gifts,
            Gifts,
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

        const eligiblePromotionIds = await findEligiblePromotionIdsForDevice({
            device,
            purchaseDate,
            requestTime,
        });

        if (eligiblePromotionIds.length === 0) {
            return sendIneligibleResult(req, res);
        }

        const promotionChannels = await Promotion_Channels.findAll({
            attributes: [
                "promotion_id",
                "channel_code",
                [fn("DATE_FORMAT", col("start_date"), "%d %b %Y"), "start_date"],
                [fn("DATE_FORMAT", col("end_date"), "%d %b %Y"), "end_date"],
            ],
            where: {
                promotion_id: {
                    [Op.in]: eligiblePromotionIds,
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

        const channelCodes = [...new Set(promotionChannels.map((item) => item.channel_code))];

        const [promotions, promotionGifts, channels] = await Promise.all([
            Promotions.findAll({
                attributes: ["id", "name", "description", "banner_url", "slug_url", "terms_url"],
                where: {
                    id: {
                        [Op.in]: eligiblePromotionIds,
                    },
                },
                raw: true,
            }),
            Promotion_Gifts.findAll({
                attributes: ["promotion_id", "gift_id"],
                where: {
                    promotion_id: {
                        [Op.in]: eligiblePromotionIds,
                    },
                },
                raw: true,
            }),
            Channels.findAll({
                attributes: ["code", "name"],
                where: {
                    code: {
                        [Op.in]: channelCodes,
                    },
                },
                raw: true,
            }),
        ]);

        const giftIds = [...new Set(promotionGifts.map((item) => item.gift_id))];
        const gifts = giftIds.length === 0
            ? []
            : await Gifts.findAll({
                attributes: ["id", "name", "alias", "color"],
                where: {
                    id: {
                        [Op.in]: giftIds,
                    },
                },
                raw: true,
            });

        const promotionMap = new Map(promotions.map((item) => [String(item.id), item]));
        const channelMap = new Map(channels.map((item) => [String(item.code), item]));
        const giftMap = new Map(gifts.map((item) => [String(item.id), item]));
        const channelAvailabilityByPromotion = new Map();
        const giftIdsByPromotion = new Map();

        promotionChannels.forEach((item) => {
            channelAvailabilityByPromotion.set(String(item.promotion_id), item);
        });

        promotionGifts.forEach((item) => {
            const promotionId = String(item.promotion_id);
            if (!giftIdsByPromotion.has(promotionId)) giftIdsByPromotion.set(promotionId, new Set());
            giftIdsByPromotion.get(promotionId).add(String(item.gift_id));
        });

        const getPromotionChannelData = (promotionId) => {
            const availability = channelAvailabilityByPromotion.get(promotionId);
            if (!availability) return null;

            const channel = channelMap.get(String(availability.channel_code));
            const channelName = channel?.name || availability.channel_code;

            return {
                name: channelName,
                period: `${availability.start_date} - ${availability.end_date}`,
            };
        };

        const eligiblePromotions = eligiblePromotionIds.flatMap((promotionIdValue) => {
            const promotionId = String(promotionIdValue);
            const promotion = promotionMap.get(promotionId);
            if (!promotion) return [];

            const promotionGiftData = [...(giftIdsByPromotion.get(promotionId) || new Set())]
                .map((giftId) => giftMap.get(giftId))
                .filter(Boolean)
                .map((gift) => ({
                    name: gift.name,
                    alias: gift.alias,
                    color: gift.color,
                }));

            return [{
                promotion_id: promotion.id,
                title: promotion.name,
                channel: getPromotionChannelData(promotionId),
                description: promotion.description,
                banner_url: process.env.R2_PUBLIC_ASSETS_URL + '/banners/Promotions/' + promotion.banner_url,
                slug_url: promotion.slug_url,
                termsURL: promotion.terms_url,
                gifts: promotionGiftData,
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
    verifyImeiChannel,
};
