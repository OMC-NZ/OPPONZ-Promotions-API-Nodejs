const { Op } = require("sequelize");
const { models } = require("../models");
const { getNewZealandTime } = require("../utils/nzTimeZone");
const { sendSuccess } = require("../utils/apiResponse");
const apiFields = require("../config/apiFields");

const getCurrentPromotions = async (req, res, next) => {
    try {
        const currentTime = getNewZealandTime();
        const { Promotion_Channels, Promotions, Channels } = models.active;

        const promotionChannels = await Promotion_Channels.findAll({
            attributes: apiFields.Promotion_Channels,
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
        });

        if (promotionChannels.length === 0) {
            return sendSuccess(req, res, {
                data: [],
            });
        }

        const promotionIds = [...new Set(promotionChannels.map((item) => item.promotion_id))];
        const channelCodes = [...new Set(promotionChannels.map((item) => item.channel_code))];

        const [promotions, channels] = await Promise.all([
            Promotions.findAll({
                attributes: apiFields.Promotions,
                where: {
                    id: {
                        [Op.in]: promotionIds,
                    },
                },
            }),
            Channels.findAll({
                attributes: apiFields.Channels,
                where: {
                    code: {
                        [Op.in]: channelCodes,
                    },
                },
            }),
        ]);

        const promotionMap = new Map(promotions.map((item) => [String(item.id), item.toJSON()]));
        const channelMap = new Map(channels.map((item) => [String(item.code), item.toJSON()]));

        const data = promotionChannels.map((item) => ({
            promotion: promotionMap.get(String(item.promotion_id)) || null,
            channel: channelMap.get(String(item.channel_code)) || null,
            availability: {
                id: item.id,
                start_date: item.start_date,
                end_date: item.end_date,
                redeem_end_date: item.redeem_end_date,
            },
        }));

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
