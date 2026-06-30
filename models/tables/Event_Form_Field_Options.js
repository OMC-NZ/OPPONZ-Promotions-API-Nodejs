const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Event_Form_Field_Options", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        field_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        option_value: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        option_label: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        sort_order: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
    }, {
        tableName: "Event_Form_Field_Options",
        timestamps: false,
    });
};
