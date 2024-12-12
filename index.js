const express = require("express");
const cors = require("cors");
const getCorsOptions = require("./config/corsConfig");
const { connectDatabase, testConnection, closeDatabases } = require("./config/dbConfig");

const app = express();

//Initialize Database
connectDatabase();
testConnection();

// Middlewares
app.use(express.json());  //parse the JSON format request body
app.use(express.urlencoded({ extended: true }));  // Parse URL-encoded format
app.use(cors(getCorsOptions()));  // Use CORS Config

//determine environment
const isDevelopment = process.env.NODE_ENV === "development";
const PORT = isDevelopment ? 3000 : 80;  // Start Project  目前由于旧Promo项目还在使用，故80端口被占用，现新Promo项目暂使用3000端口，待正式替换前需设置该端口

// Use our routes
const routes = require("./routes");
app.use(routes);

app.listen(3000, () => {
  console.log(`Server is running ${isDevelopment ? "Development" : "Production"} Mode on the port: ${PORT}`);
});

// Capture process exit events and close resources
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  await closeDatabases(); // Close DB Connection
  server.close(() => {
    console.log('Server closed.');
    process.exit(0); // Exit normally
  });
};

// Listen for exit commands
process.on('SIGINT', gracefulShutdown); // Listen for Ctrl+C
process.on('SIGTERM', gracefulShutdown); // Listen for kill
process.on('uncaughtException', async (err) => {
  console.error('Uncaught Exception:', err);
  await closeDatabases();
  process.exit(1);
});