const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('Promotions', {
		id: {
			type: DataTypes.STRING(11),
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		name: {
			type: DataTypes.STRING(70),
			allowNull: false
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		terms: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		box_image: {
			type: DataTypes.STRING(128),
			allowNull: false
		},
		mobile_image: {
			type: DataTypes.STRING(128),
			allowNull: false
		},
		url: {
			type: DataTypes.STRING(45),
			allowNull: false
		}
	}, {
		tableName: 'Promotions',
		timestamps: false
	});
};
