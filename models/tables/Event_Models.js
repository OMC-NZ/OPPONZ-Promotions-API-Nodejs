const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Event_Models", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        event_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        eligible_model: {
            type: DataTypes.STRING(45),
            allowNull: false,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Event_Models",
        timestamps: false,
    });
};
