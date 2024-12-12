const fs = require("fs");
const path = require("path");

const controllers = {};

// 动态加载 controllers 文件夹中的所有模块
const controllerFiles = fs.readdirSync(__dirname).filter((file) => file.endsWith(".js") && file !== "index.js"); // 过滤非 JS 文件和自身文件

controllerFiles.forEach((file) => {
    const moduleName = path.basename(file, ".js"); // 获取文件名作为模块名
    controllers[moduleName] = require(path.join(__dirname, file)); // 加载模块并添加到对象
});

module.exports = controllers;