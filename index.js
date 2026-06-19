const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const getCorsOptions = require("./config/corsConfig");
const config = require("./config/envConfig");
const { connectDatabase, testConnection, closeDatabases } = require("./config/dbConfig");
const {
  apiRateLimiter,
  recaptchaRateLimiter,
  enforceHttps,
} = require("./config/securityConfig");

const app = express();

app.disable("x-powered-by");
if (config.app.trustProxy) {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(cors(getCorsOptions()));
app.use(enforceHttps);
app.use(express.json({ limit: config.app.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.app.bodyLimit }));
app.use(apiRateLimiter);
app.use("/api/recaptcha/verify", recaptchaRateLimiter);

const isDevelopment = process.env.NODE_ENV === "development";
const PORT = config.app.port || (isDevelopment ? 3000 : 80);
let server;

const startServer = async () => {
  try {
    connectDatabase();
    await testConnection();

    const routes = require("./routes");
    app.use(routes);
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: "Route not found.",
      });
    });
    app.use((error, req, res, next) => {
      console.error("Request error:", error.message);
      res.status(error.status || 500).json({
        success: false,
        message: error.status ? error.message : "Internal Server Error",
      });
    });

    server = app.listen(PORT, () => {
      console.log(`Server is running ${isDevelopment ? "Development" : "Production"} Mode on the port: ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await closeDatabases();
    process.exit(1);
  }
};

const gracefulShutdown = async () => {
  console.log("Shutting down gracefully...");

  if (!server) {
    await closeDatabases();
    process.exit(0);
  }

  server.close(async () => {
    console.log("Server closed.");
    await closeDatabases();
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);
  await closeDatabases();
  process.exit(1);
});

startServer();
