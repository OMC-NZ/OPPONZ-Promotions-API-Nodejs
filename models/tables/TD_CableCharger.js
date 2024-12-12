const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('TD_CableCharger', {
		numid: {
			type: DataTypes.INTEGER(11),
			primaryKey: true,
			allowNull: false,
			autoIncrement: true
		},
		claimid: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		received_email: {
			type: DataTypes.BOOLEAN,
			allowNull: true
		},
		first_name: {
			type: DataTypes.STRING(50),
			allowNull: false
		},
		last_name: {
			type: DataTypes.STRING(50),
			allowNull: false
		},
		email: {
			type: DataTypes.STRING(70),
			allowNull: false
		},
		contact: {
			type: DataTypes.STRING(20),
			allowNull: false
		},
		street: {
			type: DataTypes.STRING(100),
			allowNull: false
		},
		suburb: {
			type: DataTypes.STRING(45),
		},
		city: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		postcode: {
			type: DataTypes.STRING(4),
			allowNull: false
		},
		company: {
			type: DataTypes.STRING(45),
			allowNull: true
		},
		created_at: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
		},
	},
		{
			tableName: 'TD_CableCharger',
			timestamps: false
		})
}