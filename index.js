const express = require("express");
const cors = require("cors");
const getCorsOptions = require('./config/corsConfig'); // 封装的 CORS 配置

const app = express();

// Middlewares
app.use(express.json());  //parse the JSON format request body
app.use(express.urlencoded({extended: true}));

// 使用 CORS 配置
app.use(cors(getCorsOptions()));

//determine environment
const isDevelopment = process.env.NODE_ENV === "development";

// Start Project  目前由于旧Promo项目还在使用，故80端口被占用，现新Promo项目暂使用3000端口，待正式替换前需设置该端口
const PORT = isDevelopment ? 3000 : 80;

app.get('/', (req, res) => {
    res.send(`Running in ${isDevelopment ? "Development" : "Production"} Mode`);
  });


app.listen(3000, () => {
    console.log(`Server is running ${isDevelopment ? "Development" : "Production"} Mode on the port: ${PORT}`);
});
