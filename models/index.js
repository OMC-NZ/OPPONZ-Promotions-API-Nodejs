const fs = require('fs');
const path = require('path');
const { getDatabase } = require("../config/dbConfig");
const { sequelizeDB: pdb, sequelizeDDB: ddb } = getDatabase();


// 存储所有模型
const models = { production: {}, development: {} };
// 动态读取当前目录中的模型文件
const modelFiles = fs.readdirSync(path.join(__dirname, 'tables')).filter((file) => file.endsWith('.js'));
modelFiles.forEach((file) => {
    const modelProd = require(path.join(__dirname, 'tables', file))(pdb); // 加载生产数据库模型
    models.production[modelProd.name] = modelProd;

    if (ddb) {
        const modelDev = require(path.join(__dirname, 'tables', file))(ddb); // 加载开发数据库模型
        models.development[modelDev.name] = modelDev;
    }
});

module.exports = {
    pdb,
    ddb,
    models,
};