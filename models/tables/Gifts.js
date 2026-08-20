const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Gifts", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(45),
            allowNull: false,
        },
        alias: {
            type: DataTypes.STRING(45),
            allowNull: false,
        },
        color: {
            type: DataTypes.STRING(45),
            allowNull: false,
        },
        status: {
            type: DataTypes.TINYINT(1),
            allowNull: false,
            defaultValue: 0,
            validate: {
                isInt: true,
                min: 0,
                max: 9,
            },
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Gifts",
        timestamps: false,
    });
};
