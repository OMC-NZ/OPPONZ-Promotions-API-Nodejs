const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Device_Redemption_Resets", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        imei: {
            type: DataTypes.STRING(15),
            allowNull: false,
        },
        previous_claim_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        reset_by: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        reset_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Device_Redemption_Resets",
        timestamps: false,
    });
};
