function getCorsOptions() {
    // 定义允许的来源
    const allowedOrigins = [
        'http://localhost:3000', // 开发环境地址
        'https://oppopromotions.co.nz', // 生产环境地址
    ];

    // 返回 CORS 配置
    return {
        origin: function (origin, callback) {
            if (allowedOrigins.includes(origin) || !origin) {
                // 如果来源在允许列表中，或者是 undefined（如同域请求），允许访问
                callback(null, true);
            } else {
                // 否则拒绝
                callback(new Error('Not allowed by CORS'));
            }
        },
    };
}

module.exports = getCorsOptions;
