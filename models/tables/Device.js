const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Device', {
        imei: {
            type: DataTypes.STRING(45),
            primaryKey: true,
            allowNull: false
        },
        model: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        category: {
            type: DataTypes.INTEGER(2),
            allowNull: true
        },
        market_name: {
            type: DataTypes.STRING(45),
            allowNull: true
        },
        color: {
            type: DataTypes.STRING(45),
            allowNull: true
        },
        channel: {
            type: DataTypes.STRING(45),
            allowNull: false
        },
        used: {
            type: DataTypes.BOOLEAN,
            allowNull:false
        },
        created_at: {
			type: DataTypes.DATE,
			allowNull: false
		},
        updated_at: {
			type: DataTypes.DATE,
			allowNull: false
		},
        imei2: {
            type: DataTypes.STRING(45),
            allowNull: true
        },
        td_used: {
            type: DataTypes.BOOLEAN,
            allowNull:false
        },
        uefa: {
            type: DataTypes.BOOLEAN,
            allowNull:false
        },
        tda17_used: {
            type: DataTypes.BOOLEAN,
            allowNull:false
        },
    },
    {
        tableName: 'Device',
		timestamps: false
    })
}