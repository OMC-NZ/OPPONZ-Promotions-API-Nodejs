const { Op } = require("sequelize");
const { models } = require("../../models");
const { getNewZealandTime } = require("../../utils/nzTimeZone");

const getCurrentPromotions = async (req, res) => {
    try {
        const currentTime = getNewZealandTime();
        const ppResults = await models.production.Promoperiod.findAll({
            attributes: ["promotion_id", "start_date"],
            where: {
                start_date: {
                    [Op.lte]: currentTime,
                },
                purchase_end_date: {
                    [Op.gte]: currentTime,
                },
            },
            order: [["start_date", "DESC"]],
        });

        const promotionIds = [...new Set(ppResults.map((item) => item.promotion_id))];

        if (promotionIds.length === 0) {
            return res.json({ promot: [] }); // 如果没有结果，直接返回空数据
        }

        const pResults = await models.production.Promotions.findAll({
            attributes: ["id", "name", "terms", "box_image"],
            where: {
                id: {
                    [Op.in]: promotionIds,
                },
            },
        });

        const promotionOrder = new Map(promotionIds.map((id, index) => [id, index]));
        const promot = pResults.sort((a, b) => {
            return promotionOrder.get(a.id) - promotionOrder.get(b.id);
        }).map((item) => {
            const data = item.toJSON();
            data.terms = (data.terms || "")
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);
            return data;
        });

        res.json({ promot });
    } catch (error) {
        console.error("Error fetching promotions:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

module.exports = {
    getCurrentPromotions
}
