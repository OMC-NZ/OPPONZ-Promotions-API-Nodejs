const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Event_Form_Uploads", {
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
        upload_key: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        upload_label: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Event_Form_Uploads",
        timestamps: false,
    });
};
