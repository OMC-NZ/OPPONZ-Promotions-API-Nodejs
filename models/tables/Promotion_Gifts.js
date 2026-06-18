const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Promotion_Gifts", {
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
        gift_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
    }, {
        tableName: "Promotion_Gifts",
        timestamps: false,
    });
};
