const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define(
      "TD_IMEI_ASvtn_Redeem",
      {
        id: {
          type: DataTypes.INTEGER(11),
          primaryKey: true,
          allowNull: false,
        },
        td_code: {
          type: DataTypes.STRING(45),
          allowNull: false,
        },
        first_name: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        last_name: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        email: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        imei: {
          type: DataTypes.STRING(45),
          allowNull: false,
        },
        channel: {
          type: DataTypes.STRING(25),
          allowNull: true
        },
        order_no: {
          type: DataTypes.STRING(64),
          allowNull: true
        },      
        received: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        used: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
      },
      {
        tableName: "TD_IMEI_ASvtn_Redeem",
        timestamps: false,
      }
    );
  };
  