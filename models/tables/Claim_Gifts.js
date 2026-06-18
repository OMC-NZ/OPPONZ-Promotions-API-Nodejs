const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Claim_Gifts", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        gift_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        claim_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
    }, {
        tableName: "Claim_Gifts",
        timestamps: false,
    });
};
