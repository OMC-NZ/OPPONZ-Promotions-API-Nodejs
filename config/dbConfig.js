const { Sequelize } = require("sequelize");
const config = require("./envConfig");

let sequelizeDB, sequelizeDDB;

const isDevelopment = config.environment === "development";
const isDevelopmentDatabaseRequired = config.ddb.required;

const connectDatabase = () => {
  const logging = isDevelopment ? console.log : false;

  sequelizeDB = new Sequelize(config.db.name, config.db.user, config.db.pass, {
    host: config.db.host,
    dialect: "mariadb",
    logging,
    pool: {
      max: config.db.poolMax,
      min: config.db.poolMin,
      acquire: config.db.acquire,
      idle: config.db.idle,
    },
    dialectOptions: {
      connectTimeout: config.db.connectTimeout,
    },
  });

  if (isDevelopment && config.ddb.host && config.ddb.user && config.ddb.name) {
    sequelizeDDB = new Sequelize(config.ddb.name, config.ddb.user, config.ddb.pass, {
      host: config.ddb.host,
      dialect: "mysql",
      logging,
      dialectOptions: {
        connectTimeout: config.db.connectTimeout,
      },
    });
  }
};

const getDatabase = () => {
  if (!sequelizeDB) {
    throw new Error("Production database instance is not initialized.");
  }
  if (isDevelopmentDatabaseRequired && !sequelizeDDB) {
    throw new Error("Development database instance is not initialized.");
  }
  return { sequelizeDB, sequelizeDDB };
};

const testConnection = async () => {
  if (!sequelizeDB) {
    throw new Error("Production database is not connected.");
  }

  await sequelizeDB.authenticate();
  console.log("Production database connection established successfully.");

  if (sequelizeDDB) {
    try {
      await sequelizeDDB.authenticate();
      console.log("Development database connection established successfully.");
    } catch (error) {
      if (isDevelopmentDatabaseRequired) {
        throw error;
      }

      console.warn("Development database is unavailable; continuing with production database only.");
      console.warn(error.message);
      await sequelizeDDB.close().catch(() => {});
      sequelizeDDB = undefined;
    }
  }
};

const closeDatabases = async () => {
  try {
    if (sequelizeDB) await sequelizeDB.close();
    if (sequelizeDDB) await sequelizeDDB.close();
    sequelizeDB = undefined;
    sequelizeDDB = undefined;
    console.log("All database connections closed.");
  } catch (error) {
    console.error("Error closing database connections:", error);
  }
};

module.exports = { connectDatabase, getDatabase, testConnection, closeDatabases };
