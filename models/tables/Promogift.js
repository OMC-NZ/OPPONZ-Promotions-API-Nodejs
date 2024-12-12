const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('Promogift', {
		id: {
			type: DataTypes.INTEGER(11),
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		promotion_id: {
			type: DataTypes.STRING(11),
			allowNull: false
		},
		gift_id: {
			type: DataTypes.INTEGER(11),
			allowNull: false
		}
	}, {
		tableName: 'Promogift',
		timestamps: false
	});
};
