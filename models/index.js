const fs = require('fs');
const path = require('path');
const { getDatabase, getDBConnection } = require("../config/dbConfig");
const configureAssociations = require("./associations");
const {
    sequelize,
    sequelizeDB: pdb,
    sequelizeDDB: ddb,
    activeDatabaseLabel,
} = getDatabase();

const modelFiles = fs.readdirSync(path.join(__dirname, 'tables')).filter((file) => file.endsWith('.js')).sort();

const createModelSet = (connection) => {
    const modelSet = {};
    modelFiles.forEach((file) => {
        const model = require(path.join(__dirname, 'tables', file))(connection);
        modelSet[model.name] = model;
    });
    configureAssociations(modelSet);
    return modelSet;
};

const activeModels = createModelSet(sequelize);
const models = {
    active: activeModels,
    production: pdb ? activeModels : {},
    development: ddb ? activeModels : {},
};

let dbModelContext;
const getDBModelContext = () => {
    const connection = getDBConnection();
    if (!dbModelContext || dbModelContext.sequelize !== connection) {
        const dbModels = connection === sequelize ? activeModels : createModelSet(connection);
        dbModelContext = { sequelize: connection, models: dbModels };
        models.production = dbModels;
    }
    return dbModelContext;
};

module.exports = {
    sequelize,
    pdb,
    ddb,
    models,
    activeModels,
    activeDatabaseLabel,
    getDBModelContext,
};
