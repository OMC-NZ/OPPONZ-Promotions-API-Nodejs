const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('Gift', {
		id: {
			type: DataTypes.INTEGER(11),
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		name: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		code: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		color: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
	}, {
		tableName: 'Gift',
		timestamps: false
	});
};
