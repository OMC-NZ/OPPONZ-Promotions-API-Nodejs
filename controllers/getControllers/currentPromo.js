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
        });

        const promotionIds = [...new Set(ppResults.map((item) => item.promotion_id))];

        if (promotionIds.length === 0) {
            return res.json({ promot: [] }); // 如果没有结果，直接返回空数据
        }

        const pResults = await models.production.Promotions.findAll({
            attributes: ["id", "name", "terms", "box_image"],
            where: {
                id: promotionIds, // 使用 promotionIds 作为条件
            },
        });

        // 处理 terms 字段并整理返回数据
        const promot = pResults.map((item) => {
            const data = item.toJSON();
            data.terms = data.terms
                .split("\n")
                .map((line) => line.trim());
            return data;
        }).reverse(); // 反转结果数组

        res.json({ promot });
    } catch (error) {
        console.error("Error fetching promotions:", error);
        res.status(500).send("Internal Server Error");
    }
}

module.exports = {
    getCurrentPromotions
}
