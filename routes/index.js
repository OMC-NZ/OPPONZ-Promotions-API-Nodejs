const express = require("express");
const routeConfig = require("../config/routesConfig");
const controllers = require("../controllers");

const router = express.Router();

// 动态加载路由
routeConfig.forEach((route) => {
    const [controllerName, methodName] = route.handler.split(".");
    const controller = controllers[controllerName];
    if (controller && controller[methodName]) {
        router[route.method](route.path, controller[methodName]);
    } else {
        console.warn(`Handler not found: ${route.handler}`);
    }
});

module.exports = router;