const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Claims", {
        id: {
            type: DataTypes.STRING(255),
            allowNull: false,
            primaryKey: true,
        },
        promotion_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        imei: {
            type: DataTypes.STRING(15),
            allowNull: false,
        },
        customer_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        purchase_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        status: {
            type: DataTypes.TINYINT(1),
            allowNull: false,
        },
        receipt_url: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        screenshot_url: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        email_status: {
            type: DataTypes.TINYINT(1),
            allowNull: false,
            defaultValue: 0,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Claims",
        timestamps: false,
    });
};
