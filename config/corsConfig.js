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
                callback(new Error('Not allowed by CORS'));
            }
        },
    };
}

module.exports = getCorsOptions;
