//Dynamically load environment configurations

const dotenv = require("dotenv");
const path = require("path");

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, "../.env") }); // 加载通用配置

// 导出分组的配置信息
module.exports = {
    app: {
        port: process.env.APP_PORT,
        apiVersion: process.env.API_VERSION,
    },
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        name: process.env.DB_NAME,
    },
    ddb: {
        host: process.env.DDB_HOST,
        user: process.env.DDB_USER,
        pass: process.env.DDB_PASS,
        name: process.env.DDB_NAME,
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    thirdParty: {
        apiKey: process.env.THIRD_PARTY_API_KEY,
        apiSecret: process.env.THIRD_PARTY_API_SECRET,
    },
    common: {
        tokenSecret: process.env.TOKEN_SECRET,
    },
};