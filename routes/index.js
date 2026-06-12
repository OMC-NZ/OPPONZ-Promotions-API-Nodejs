const express = require("express");
const routeConfig = require("../config/routesConfig");
const controllers = require("../controllers");

const router = express.Router();
const supportedMethods = new Set(["get", "post", "put", "patch", "delete"]);

routeConfig.forEach((route) => {
    if (!supportedMethods.has(route.method)) {
        console.warn(`Unsupported route method: ${route.method} ${route.path}`);
        return;
    }

    const [controllerName, methodName] = route.handler.split(".");
    const controller = controllers[controllerName];
    if (typeof controller?.[methodName] === "function") {
        router[route.method](route.path, controller[methodName]);
    } else {
        console.warn(`Handler not found: ${route.handler}`);
    }
});

module.exports = router;
