const fs = require('fs');
const path = require('path');
const { getDatabase } = require("../config/dbConfig");
const {
    sequelize,
    sequelizeDB: pdb,
    sequelizeDDB: ddb,
    activeDatabaseLabel,
} = getDatabase();

const activeModels = {};
const models = {
    active: activeModels,
    production: pdb ? activeModels : {},
    development: ddb ? activeModels : {},
};

const modelFiles = fs.readdirSync(path.join(__dirname, 'tables')).filter((file) => file.endsWith('.js')).sort();
modelFiles.forEach((file) => {
    const model = require(path.join(__dirname, 'tables', file))(sequelize);
    activeModels[model.name] = model;
});

module.exports = {
    sequelize,
    pdb,
    ddb,
    models,
    activeModels,
    activeDatabaseLabel,
};
