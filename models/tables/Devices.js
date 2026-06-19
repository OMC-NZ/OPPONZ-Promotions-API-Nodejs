const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Devices", {
        imei: {
            type: DataTypes.STRING(15),
            allowNull: false,
            primaryKey: true,
        },
        model: {
            type: DataTypes.STRING(7),
            allowNull: false,
        },
        category: {
            type: DataTypes.TINYINT(2),
            allowNull: false,
        },
        market_name: {
            type: DataTypes.STRING(45),
            allowNull: false,
        },
        color: {
            type: DataTypes.STRING(45),
            allowNull: false,
        },
        channel_code: {
            type: DataTypes.STRING(4),
            allowNull: false,
        },
        redemption_status: {
            type: DataTypes.TINYINT(1),
            allowNull: false,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Devices",
        timestamps: false,
    });
};
