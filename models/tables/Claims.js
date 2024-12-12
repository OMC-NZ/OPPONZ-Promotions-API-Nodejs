const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('Claims', {
		id: {
			type: DataTypes.STRING(45),
			allowNull: false,
			primaryKey: true
		},
		promotion_id: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		imei: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		received_email: {
			type: DataTypes.BOOLEAN,
			allowNull: true
		},
		progress: {
			type: DataTypes.INTEGER(1),
			allowNull: false
		},
		date_submitted: {
			type: DataTypes.DATE,
			allowNull: false
		},
		receipt: {
			type: DataTypes.STRING(64),
			allowNull: true
		},
		screenshot: {
			type: DataTypes.STRING(64),
			allowNull: true
		},
	},
		{
			tableName: 'Claims',
			timestamps: false
		});
};
