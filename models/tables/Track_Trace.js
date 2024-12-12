const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('Track_Trace', {
		id: {
			type: DataTypes.INTEGER(11),
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		address_id: {
			type: DataTypes.INTEGER(11),
			allowNull: false
		},
		track_link: {
			type: DataTypes.STRING(80),
			allowNull: false
		},
		created_at: {
			type: DataTypes.DATE,
			allowNull: false
		}
	}, {
		tableName: 'Track_Trace',
		timestamps: false
	});
};
