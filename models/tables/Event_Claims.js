const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Event_Claims", {
        id: {
            type: DataTypes.STRING(255),
            allowNull: false,
            primaryKey: true,
        },
        event_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        imei: {
            type: DataTypes.STRING(15),
            allowNull: false,
        },
        customer_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        status: {
            type: DataTypes.TINYINT(1),
            allowNull: false,
        },
        extra_data: {
            type: DataTypes.TEXT("long"),
            allowNull: true,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Event_Claims",
        timestamps: false,
    });
};
