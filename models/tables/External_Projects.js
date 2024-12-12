const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('External_Projects', {
		id: {
			type: DataTypes.INTEGER(11),
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		nick_name: {
			type: DataTypes.STRING(45),
			allowNull: false
		},
		description: {
			type: DataTypes.STRING(255),
			allowNull: true
		}
	}, {
		tableName: 'External_Projects',
		timestamps: false
	});
};
