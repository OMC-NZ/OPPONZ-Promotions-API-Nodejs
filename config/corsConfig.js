const config = require("./envConfig");

function getCorsOptions() {
    const defaultOrigins = [
        'http://localhost:3000', // 开发环境地址
        'http://localhost:3001',
        'https://oppopromotions.co.nz', // 生产环境地址
    ];
    const allowedOrigins = [...new Set([...defaultOrigins, ...config.app.corsOrigins])];

    return {
        origin: function (origin, callback) {
            if (allowedOrigins.includes(origin) || !origin) {
                callback(null, true);
            } else {
                const error = new Error("Not allowed by CORS");
                error.status = 403;
                callback(error);
            }
        },
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        maxAge: 86400,
        optionsSuccessStatus: 204,
    };
}

module.exports = getCorsOptions;
