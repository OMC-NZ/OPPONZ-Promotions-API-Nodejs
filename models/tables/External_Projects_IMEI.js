const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('External_Projects_IMEI', {
        pimei_id: {
            type: DataTypes.INTEGER(11),
            primaryKey: true,
            allowNull: false
        },
        imei: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        product_id: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        project_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        used: {
            type: DataTypes.BOOLEAN,
            allowNull:false
        }
    },
    {
        tableName: 'External_Projects_IMEI',
		timestamps: false
    })
}