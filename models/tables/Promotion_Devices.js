const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Promotion_Devices", {
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
        eligible_model: {
            type: DataTypes.STRING(7),
            allowNull: false,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Promotion_Devices",
        timestamps: false,
    });
};
