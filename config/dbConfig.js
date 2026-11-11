const { Sequelize } = require("sequelize");
const config = require("./envConfig");

let activeDatabase;
let dbDatabase;

const isDevelopment = config.environment === "development";
const activeConfig = isDevelopment ? config.ddb : config.db;
const activeDatabaseLabel = isDevelopment ? "Development" : "Production";
const activeDialect = isDevelopment ? "mysql" : "mariadb";

const createDatabaseConnection = (databaseConfig, dialect, label) => {
  const logging = isDevelopment ? console.log : false;

  if (!databaseConfig.host || !databaseConfig.user || !databaseConfig.name) {
    throw new Error(`${label} database configuration is incomplete.`);
  }

  return new Sequelize(databaseConfig.name, databaseConfig.user, databaseConfig.pass, {
    host: databaseConfig.host,
    port: databaseConfig.port,
    dialect,
    logging,
    pool: {
      max: databaseConfig.poolMax,
      min: databaseConfig.poolMin,
      acquire: databaseConfig.acquire,
      idle: databaseConfig.idle,
    },
    dialectOptions: {
      connectTimeout: databaseConfig.connectTimeout,
    },
  });
};

const connectDatabase = () => {
  if (!activeDatabase) activeDatabase = createDatabaseConnection(activeConfig, activeDialect, activeDatabaseLabel);
  return activeDatabase;
};

const getDBConnection = () => {
  if (!isDevelopment) return connectDatabase();
  if (!dbDatabase) dbDatabase = createDatabaseConnection(config.getCurrentListDatabaseConfig(), "mariadb", "DB");
  return dbDatabase;
};

const getDatabase = () => {
  if (!activeDatabase) {
    throw new Error(`${activeDatabaseLabel} database instance is not initialized.`);
  }

  return {
    sequelize: activeDatabase,
    activeDatabase,
    activeDatabaseLabel,
    sequelizeDB: isDevelopment ? dbDatabase : activeDatabase,
    sequelizeDDB: isDevelopment ? activeDatabase : undefined,
  };
};

const testConnection = async () => {
  if (!activeDatabase) {
    throw new Error(`${activeDatabaseLabel} database is not connected.`);
  }

  try {
    await activeDatabase.authenticate();
    console.log(`${activeDatabaseLabel} database connection established successfully: ${activeConfig.name}`);
  } catch (error) {
    throw new Error(
      `${activeDatabaseLabel} database connection failed: ${activeConfig.name} (${error.message})`,
      { cause: error }
    );
  }
};

const closeDatabases = async () => {
  const databases = [...new Set([activeDatabase, dbDatabase].filter(Boolean))];
  const results = await Promise.allSettled(databases.map((database) => database.close()));
  activeDatabase = undefined;
  dbDatabase = undefined;
  for (const result of results) {
    if (result.status === "rejected") console.error("Error closing database connection:", result.reason);
  }
  console.log("Database connection closed.");
};

module.exports = { connectDatabase, getDatabase, getDBConnection, testConnection, closeDatabases };
