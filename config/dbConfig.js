const { Sequelize } = require('sequelize');
const config = require('./envConfig');

let sequelizeDB, sequelizeDDB;

const connectDatabase = () => {
  // 创建生产数据库连接
  sequelizeDB = new Sequelize(config.db.name, config.db.user, config.db.pass, {
    host: config.db.host,
    dialect: 'mariadb',
    logging: console.log, // 生产环境可以关闭日志
    pool: {
      max: 10, // 最大连接数
      min: 0,  // 最小连接数
      acquire: 30000, // 获取连接的最长时间 (毫秒)
      idle: 10000,    // 连接空闲时间 (毫秒)
    },
    dialectOptions: {
      connectTimeout: 20000, // 连接超时时间 (毫秒)
    },
  });

  // 在开发模式下创建第二个数据库连接
  if (config.environment === 'development') {
    sequelizeDDB = new Sequelize(config.ddb.name, config.ddb.user, config.ddb.pass, {
      host: config.ddb.host,
      dialect: 'mysql',
      logging: console.log, // 开发环境开启日志
    });
  }
};

// 获取 Sequelize 实例
const getDatabase = (useDev = false) => {
  if (!sequelizeDB) {
    throw new Error('Production database instance is not initialized.');
  }
  if (config.environment === 'development' && !sequelizeDDB) {
    throw new Error('Development database instance is not initialized.');
  }
  return { sequelizeDB, sequelizeDDB };
};

// 测试连接
const testConnection = () => {
  if (sequelizeDB) {
    console.log('Production database connection established successfully.');
    if (sequelizeDDB) {
      console.log('Development database connection established successfully.');
    }
  } else {
    console.log('Production database is not connected.');
  }
};

// 关闭数据库连接
const closeDatabases = async () => {
  try {
    if (sequelizeDB) await sequelizeDB.close();
    if (sequelizeDDB) await sequelizeDDB.close();
    console.log('All database connections closed.');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
};

module.exports = { connectDatabase, getDatabase, testConnection, closeDatabases };
