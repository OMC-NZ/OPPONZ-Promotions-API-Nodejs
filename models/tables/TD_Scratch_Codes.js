const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("TD_Scratch_Codes", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        td_code: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        event_claim_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        used: {
            type: DataTypes.TINYINT(1),
            allowNull: false,
        },
    }, {
        tableName: "TD_Scratch_Codes",
        timestamps: false,
    });
};
