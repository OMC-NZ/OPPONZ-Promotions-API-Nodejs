const config = require("../config/envConfig");
const { getDatabase } = require("../config/dbConfig");

const getHealth = async (req, res) => {
    res.set("Cache-Control", "no-store");

    try {
        const { sequelize, activeDatabaseLabel } = getDatabase();
        await sequelize.authenticate();

        return res.status(200).json({
            status: "ok",
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            environment: config.environment,
            database: {
                status: "up",
                target: activeDatabaseLabel.toLowerCase(),
            },
        });
    } catch (error) {
        console.error("Health check failed:", error.message);
        return res.status(503).json({
            status: "unavailable",
            timestamp: new Date().toISOString(),
            database: {
                status: "down",
            },
        });
    }
};

module.exports = {
    getHealth,
};
