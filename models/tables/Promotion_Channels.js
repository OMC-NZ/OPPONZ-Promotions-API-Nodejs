const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Promotion_Channels", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        promotion_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        channel_code: {
            type: DataTypes.STRING(4),
            allowNull: false,
        },
        start_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        end_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        redeem_end_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Promotion_Channels",
        timestamps: false,
    });
};
