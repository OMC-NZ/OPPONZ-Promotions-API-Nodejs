const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('Promoperiod', {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		start_date: {
			type: DataTypes.DATE,
			allowNull: false
		},
		purchase_end_date: {
			type: DataTypes.DATE,
			allowNull: false
		},
		end_date: {
			type: DataTypes.DATE,
			allowNull: false
		},
		promotion_id: {
			type: DataTypes.STRING(11),
			allowNull: false
		},
		channel_name: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
	}, {
		tableName: 'Promoperiod',
		timestamps: false
	});
};
