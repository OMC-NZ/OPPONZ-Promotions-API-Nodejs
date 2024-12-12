const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('Promodel', {
		id: {
			type: DataTypes.INTEGER(11),
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		model: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		promoperiod_id: {
			type: DataTypes.INTEGER(11),
			allowNull: false
		}
	}, {
		tableName: 'Promodel',
		timestamps: false
	});
};
