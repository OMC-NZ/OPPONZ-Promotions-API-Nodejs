module.exports = {
    apps: [
        {
            name: "OPPONZ-Promotions-API-Nodejs",
            script: "index.js",
            exec_mode: "fork",
            instances: 1, // 实例数（根据需要设置）
            env: {
                NODE_ENV: "production", // 生产环境
            },
        },
    ],
};
