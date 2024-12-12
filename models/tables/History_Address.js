const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('History_Address', {
		id: {
			type: DataTypes.INTEGER(11),
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		street: {
			type: DataTypes.STRING(45),
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
		instructions: {
			type: DataTypes.STRING(50),
			allowNull: true
		},
		created_at: {
			type: DataTypes.DATE,
			allowNull: false
		},
		claim_id: {
			type: DataTypes.STRING(45),
			allowNull: false
		}
	}, {
		tableName: 'History_Address',
		timestamps: false
	});
};
