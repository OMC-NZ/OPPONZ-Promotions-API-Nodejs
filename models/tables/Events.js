const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Events", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        banner_url: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        slug_url: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        requires_imei: {
            type: DataTypes.TINYINT(1),
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
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Events",
        timestamps: false,
    });
};
