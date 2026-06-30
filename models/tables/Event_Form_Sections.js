const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Event_Form_Sections", {
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
        section_title: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        sort_order: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Event_Form_Sections",
        timestamps: false,
    });
};
