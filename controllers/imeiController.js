const { Op, fn, col } = require("sequelize");
const { models, getDBModelContext } = require("../models");
const { findEligiblePromotionChannelsForDevice } = require("../services/promotionEligibilityService");
const { getEventDeviceVerification } = require("../services/eventEligibilityService");
const { normalizeText } = require("../utils/text");
const { buildAssetUrl } = require("../utils/assetUrl");
const config = require("../config/envConfig");
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
        const slugUrl = normalizeText(req.body.slug_url);
        const event = await models.active.Events.findOne({
            attributes: ["id"], where: { slug_url: slugUrl }, raw: true,
        });
        const result = event
            ? await getEventDeviceVerification({ event, imei, checkRestrictions: true })
            : { verified: false };

        return sendSuccess(req, res, {
            data: {
                verified: result.verified,
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
        const dbContext = getDBModelContext();
        const { imei, purchase_date: purchaseDateInput } = req.body;
        const requestTime = getNewZealandTime();
        const purchaseDate = toNewZealandDateTime(purchaseDateInput);
        const {
            Devices,
            Channels,
            Promotions,
            Promotion_Gifts,
            Gifts,
        } = dbContext.models;

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

        const promotionChannels = await findEligiblePromotionChannelsForDevice({
            modelContext: dbContext,
            device,
            purchaseDate,
            requestTime,
            attributes: [
                "promotion_id",
                "channel_code",
                [fn("DATE_FORMAT", col("start_date"), "%d %b %Y"), "start_date"],
                [fn("DATE_FORMAT", col("end_date"), "%d %b %Y"), "end_date"],
            ],
        });
        const eligiblePromotionIds = [...new Set(promotionChannels.map((item) => item.promotion_id))]
            .sort((left, right) => Number(right) - Number(left));

        if (eligiblePromotionIds.length === 0) return sendIneligibleResult(req, res);

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
                attributes: ["id", "name", "alias", "color", "status"],
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
                    status: gift.status,
                }));

            return [{
                promotion_id: promotion.id,
                title: promotion.name,
                channel: getPromotionChannelData(promotionId),
                description: promotion.description,
                banner_url: buildAssetUrl(config.r2.publicBaseUrl, "banners/Promotions", promotion.banner_url),
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
