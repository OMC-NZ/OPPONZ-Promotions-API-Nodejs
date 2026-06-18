const { Sequelize } = require("sequelize");
const config = require("./envConfig");

let activeDatabase;

const isDevelopment = config.environment === "development";
const activeConfig = isDevelopment ? config.ddb : config.db;
const activeDatabaseLabel = isDevelopment ? "Development" : "Production";
const activeDialect = isDevelopment ? "mysql" : "mariadb";

const connectDatabase = () => {
  const logging = isDevelopment ? console.log : false;

  if (!activeConfig.host || !activeConfig.user || !activeConfig.name) {
    throw new Error(`${activeDatabaseLabel} database configuration is incomplete.`);
  }

  activeDatabase = new Sequelize(activeConfig.name, activeConfig.user, activeConfig.pass, {
    host: activeConfig.host,
    port: activeConfig.port,
    dialect: activeDialect,
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
};

const getDatabase = () => {
  if (!activeDatabase) {
    throw new Error(`${activeDatabaseLabel} database instance is not initialized.`);
  }

  return {
    sequelize: activeDatabase,
    activeDatabase,
    activeDatabaseLabel,
    sequelizeDB: isDevelopment ? undefined : activeDatabase,
    sequelizeDDB: isDevelopment ? activeDatabase : undefined,
  };
};

const testConnection = async () => {
  if (!activeDatabase) {
    throw new Error(`${activeDatabaseLabel} database is not connected.`);
  }

  await activeDatabase.authenticate();
  console.log(`${activeDatabaseLabel} database connection established successfully.`);
};

const closeDatabases = async () => {
  try {
    if (activeDatabase) await activeDatabase.close();
    activeDatabase = undefined;
    console.log("Database connection closed.");
  } catch (error) {
    console.error("Error closing database connection:", error);
  }
};

module.exports = { connectDatabase, getDatabase, testConnection, closeDatabases };
