const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Deliver_Addresses", {
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
        street: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        suburb: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        city: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        postcode: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        instructions: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        is_current: {
            type: DataTypes.TINYINT(1),
            allowNull: false,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Deliver_Addresses",
        timestamps: false,
    });
};
