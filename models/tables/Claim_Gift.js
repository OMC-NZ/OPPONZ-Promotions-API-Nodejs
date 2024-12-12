const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('Claim_Gift', {
		id: {
			type: DataTypes.INTEGER(11),
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		gift_name: {
			type: DataTypes.STRING(75),
			allowNull: false
		},
		claim_id: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		gift_changed: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
	}, {
		tableName: 'Claim_Gift',
		timestamps: false
	});
};
