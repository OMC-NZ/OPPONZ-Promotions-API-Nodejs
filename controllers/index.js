const fs = require("fs");
const path = require("path");

const controllers = {};

// 递归加载指定目录下的所有 .js 文件（排除 index.js 本身）
function loadModulesFromDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // 递归进入子目录
            loadModulesFromDir(fullPath);
        } else if (file.endsWith(".js") && file !== "index.js") {
            const moduleName = path.basename(file, ".js");
            controllers[moduleName] = require(fullPath);
        }
    })
}

loadModulesFromDir(__dirname);

module.exports = controllers;