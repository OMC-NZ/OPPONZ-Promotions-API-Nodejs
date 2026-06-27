const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Deliveries", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        claim_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        reference: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
    }, {
        tableName: "Deliveries",
        timestamps: false,
    });
};
