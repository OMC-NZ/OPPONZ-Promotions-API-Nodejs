const { Op } = require("sequelize");
const { models } = require("../models");
const { getNewZealandTime } = require("../utils/nzTimeZone");

const getCurrentPromotions = async (req, res) => {
    try {
        const currentTime = getNewZealandTime();
        const { Promotion_Channels, Promotions, Channels } = models.active;

        const promotionChannels = await Promotion_Channels.findAll({
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
            return res.status(200).json({
                success: true,
                data: [],
            });
        }

        const promotionIds = [...new Set(promotionChannels.map((item) => item.promotion_id))];
        const channelCodes = [...new Set(promotionChannels.map((item) => item.channel_code))];

        const [promotions, channels] = await Promise.all([
            Promotions.findAll({
                where: {
                    id: {
                        [Op.in]: promotionIds,
                    },
                },
            }),
            Channels.findAll({
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

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Error fetching current promotions:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch current promotions.",
        });
    }
};

module.exports = {
    getCurrentPromotions,
};
