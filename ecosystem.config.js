module.exports = {
    apps: [
        {
            name: "OPPONZ-Promotions-API-Nodejs",
            script: "index.js",
            exec_mode: "fork",
            instances: 1,
            env: {
                NODE_ENV: "production",
            },
            env_production: {
                NODE_ENV: "production",
            },
        },
    ],
};
