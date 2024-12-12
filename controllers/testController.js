const { models } = require("../models");

const getTesting = async (req, res) => {
    try {
        const results = await models.production.Device.findAll({
            where: {
                imei: '864336060373530'
            },
            raw: true,
        })
        if (!results) {
            return res.status(404).send("Device not found");
        }
        console.log(results)
        res.json(results);
    } catch (error) {
        console.error("Error fetching promotions:", error);
        res.status(500).send("Internal Server Error");
    }
}

module.exports = {
    getTesting
}