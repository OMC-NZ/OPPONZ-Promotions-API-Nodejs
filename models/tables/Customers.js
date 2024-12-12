const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('Customers', {
		id: {
			type: DataTypes.INTEGER(11),
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		first_name: {
			type: DataTypes.STRING(50),
			allowNull: false
		},
		middle_name: {
			type: DataTypes.STRING(45),
			allowNull: true
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
		imei: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		order_no: {
			type: DataTypes.STRING(45),
			allowNull: true
		},
		subscription: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		}
	}, {
		tableName: 'Customers',
		timestamps: false
	});
};
