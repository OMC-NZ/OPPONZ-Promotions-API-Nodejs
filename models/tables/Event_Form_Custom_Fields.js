const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    return sequelize.define("Event_Form_Custom_Fields", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        section_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        field_key: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        field_label: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        field_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        placeholder: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        is_required: {
            type: DataTypes.TINYINT(1),
            allowNull: false,
        },
        sort_order: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
        },
        validation_json: {
            type: DataTypes.TEXT("long"),
            allowNull: true,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: "Event_Form_Custom_Fields",
        timestamps: false,
    });
};
