const config = require("./env");
const { Sequelize } = require("sequelize");

// config production db
const sequelizeDB = new Sequelize(
    config.db.name, // 数据库名
    config.db.user, // 用户名
    config.db.pass, // 密码
    {
        host: config.db.host, // 主机
        dialect: 'mariadb', // 数据库类型
        logging: false, // 关闭日志输出 (可选)
    }
);

// config development db
const sequelizeDDB = new Sequelize(
    config.ddb.name, // 数据库名
    config.ddb.user, // 用户名
    config.ddb.pass, // 密码
    {
        host: config.ddb.host, // 主机
        dialect: 'mariadb', // 数据库类型
        logging: false, // 关闭日志输出 (可选)
    }
);

// 测试连接
const testConnection = async (sequelize, dbName) => {
    try {
      await sequelize.authenticate();
      console.log(`Connection to ${dbName} has been established successfully.`);
    } catch (error) {
      console.error(`Unable to connect to ${dbName}:`, error);
    }
  };

// 测试两个数据库连接
testConnection(sequelizeDB, 'Production DB');
testConnection(sequelizeDDB, 'Development DB');

module.exports = {sequelizeDB, sequelizeDDB};