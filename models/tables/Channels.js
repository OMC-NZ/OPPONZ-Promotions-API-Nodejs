const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Channels", {
        code: {
            type: DataTypes.STRING(4),
            allowNull: false,
            primaryKey: true,
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        category: {
            type: DataTypes.STRING(45),
            allowNull: false,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Channels",
        timestamps: false,
    });
};
