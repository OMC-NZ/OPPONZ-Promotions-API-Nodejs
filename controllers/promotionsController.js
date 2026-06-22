const { Op, fn, col } = require("sequelize");
const { models } = require("../models");
const { getNewZealandTime } = require("../utils/nzTimeZone");
const { sendSuccess } = require("../utils/apiResponse");
const apiFields = require("../config/apiFields");

const sortChannelNames = (left, right) => {
    const leftFirstWord = left.trim().split(/\s+/)[0];
    const rightFirstWord = right.trim().split(/\s+/)[0];
    const firstWordComparison = leftFirstWord.localeCompare(rightFirstWord, "en-NZ", {
        sensitivity: "base",
    });

    return firstWordComparison || left.localeCompare(right, "en-NZ", { sensitivity: "base" });
};

const groupChannelsByDate = (availabilityMap, channelMap) => {
    const groupedChannels = new Map();

    availabilityMap.forEach((availability, channelCode) => {
        const channel = channelMap.get(channelCode);
        if (!channel?.name) return;

        const startDate = availability.start_date;
        const endDate = availability.end_date;
        const groupKey = `${startDate}|${endDate}`;

        if (!groupedChannels.has(groupKey)) {
            groupedChannels.set(groupKey, {
                names: new Set(),
                start_date: startDate,
                end_date: endDate,
            });
        }

        groupedChannels.get(groupKey).names.add(channel.name.trim());
    });

    return [...groupedChannels.values()]
        .map((group) => ({
            names: [...group.names].sort(sortChannelNames),
            start_date: group.start_date,
            end_date: group.end_date,
        }))
        .sort((left, right) => {
            const startDateComparison = left.start_date.localeCompare(right.start_date);
            return startDateComparison || left.end_date.localeCompare(right.end_date);
        });
};

const getCurrentPromotions = async (req, res, next) => {
    try {
        const currentTime = getNewZealandTime();
        const {
            Promotions,
            Channels,
            Promotion_Channels,
        } = models.active;

        const activePromotionChannels = await Promotion_Channels.findAll({
            attributes: [
                "promotion_id",
                "channel_code",
                [fn("DATE_FORMAT", col("start_date"), "%Y-%m-%d"), "start_date"],
                [fn("DATE_FORMAT", col("end_date"), "%Y-%m-%d"), "end_date"],
            ],
            where: {
                start_date: {
                    [Op.lte]: currentTime,
                },
                end_date: {
                    [Op.gte]: currentTime,
                },
            },
            order: [
                ["start_date", "DESC"],
                ["id", "ASC"],
            ],
            raw: true,
        });

        if (activePromotionChannels.length === 0) {
            return sendSuccess(req, res, {
                data: [],
            });
        }

        const promotionIds = [...new Set(activePromotionChannels.map((item) => item.promotion_id))];
        const sortedPromotionIds = [...promotionIds].sort((left, right) => Number(right) - Number(left));
        const channelCodes = [...new Set(activePromotionChannels.map((item) => item.channel_code))];

        const [promotions, channels] = await Promise.all([
            Promotions.findAll({
                attributes: apiFields.Promotions,
                where: {
                    id: {
                        [Op.in]: promotionIds,
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

        const promotionMap = new Map(promotions.map((item) => [String(item.id), item]));
        const channelMap = new Map(channels.map((item) => [String(item.code), item]));
        const channelAvailabilityByPromotion = new Map();

        activePromotionChannels.forEach((item) => {
            const promotionId = String(item.promotion_id);
            if (!channelAvailabilityByPromotion.has(promotionId)) {
                channelAvailabilityByPromotion.set(promotionId, new Map());
            }
            channelAvailabilityByPromotion.get(promotionId).set(String(item.channel_code), item);
        });

        const data = sortedPromotionIds.flatMap((promotionIdValue) => {
            const promotionId = String(promotionIdValue);
            const promotion = promotionMap.get(promotionId);
            if (!promotion) return [];

            const availabilityMap = channelAvailabilityByPromotion.get(promotionId) || new Map();
            const promotionChannelData = groupChannelsByDate(availabilityMap, channelMap);

            return [{
                title: promotion.name,
                gifts: promotion.description,
                url: promotion.slug_url,
                banner: process.env.PROMOTIONS_PUBLIC_ASSETS_URL + '/banners/Promotions/' + promotion.banner_url,
                channels: promotionChannelData,
            }];
        });

        return sendSuccess(req, res, {
            data,
        });
    } catch (error) {
        console.error("Error fetching current promotions:", error);
        error.status = 500;
        error.publicMessage = "Failed to fetch current promotions.";
        return next(error);
    }
};

module.exports = {
    getCurrentPromotions,
};
