const { Op } = require("sequelize");
const { models } = require("../../models");

const getCheckIMEI = async (req, res) => {
    try {
        const { imei } = req.body;
        const result = await models.production.Device.findOne({
            attributes: ['model', 'channel'],
            where: {
                imei: imei,
                category: 11,
                used: 0
            }
        })

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Sorry, there are no promotions suitable for your OPPO products at present!",
                available: false
            });
        }

        res.status(200).json({
            success: true,
            available: true,
            data: result
        });
    } catch (error) {
        console.error("Error fetching promotions:", error);
        res.status(500).send("Internal Server Error");
    }
}

module.exports = {
    getCheckIMEI
}