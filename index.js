const { installConsoleTimestamp } = require("./utils/consoleTimestamp");

installConsoleTimestamp();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const getCorsOptions = require("./config/corsConfig");
const getHelmetOptions = require("./config/helmetConfig");
const config = require("./config/envConfig");
const { connectDatabase, testConnection, closeDatabases } = require("./config/dbConfig");
const {
  enforceHttps,
} = require("./config/securityConfig");
const { requestContext } = require("./middlewares/requestContext");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");
const { requestLogger } = require("./middlewares/requestLogger");
const { startLogCleanup, flushLogs } = require("./services/logService");
const { closeMailTransporter } = require("./services/mailService");
const { normalizeText } = require("./utils/text");
const { alertError } = require("./services/errorAlertService");
const { checkProductionSecurityConfig } = require("./config/startupSecurityCheck");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", config.app.trustProxy);

app.use(requestContext);
app.use(requestLogger);
app.use(helmet(getHelmetOptions()));
app.use(cors(getCorsOptions()));
app.use(enforceHttps);
app.use(express.json({ limit: config.app.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.app.bodyLimit }));

const isDevelopment = process.env.NODE_ENV === "development";
const PORT = config.app.port || (isDevelopment ? 3000 : 80);
let server;

const applyServerTimeouts = (httpServer) => {
  httpServer.requestTimeout = config.server.requestTimeoutMs;
  httpServer.headersTimeout = config.server.headersTimeoutMs;
  httpServer.keepAliveTimeout = config.server.keepAliveTimeoutMs;
};

const startServer = async () => {
  try {
    checkProductionSecurityConfig();
    startLogCleanup();
    connectDatabase();
    await testConnection();

    const routes = require("./routes");
    app.use(routes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    await new Promise((resolve, reject) => {
      server = app.listen(PORT);
      server.once("error", reject);
      server.once("listening", () => {
        server.removeListener("error", reject);
        resolve();
      });
      applyServerTimeouts(server);
    });
    console.log(`Server is running ${isDevelopment ? "Development" : "Production"} Mode on the port: ${PORT}`);
    console.log(`Server time check: local=${new Date().toString()}`);
    console.log(`Trust proxy setting: ${JSON.stringify(config.app.trustProxy)}`);
    console.log(`Server timeouts: request=${server.requestTimeout}ms, headers=${server.headersTimeout}ms, keepAlive=${server.keepAliveTimeout}ms`);
  } catch (error) {
    console.error("Failed to start server:", error);
    await alertError({
      error,
      status: 500,
      requestId: "startup",
    });
    await closeDatabases();
    closeMailTransporter();
    await flushLogs();
    process.exit(1);
  }
};

let shuttingDown = false;
const gracefulShutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  console.log("Shutting down gracefully...");

  if (!server) {
    await closeDatabases();
    closeMailTransporter();
    await flushLogs();
    process.exit(0);
  }

  server.close(async () => {
    console.log("Server closed.");
    await closeDatabases();
    closeMailTransporter();
    await flushLogs();
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);
  await alertError({
    error: err,
    status: 500,
    requestId: "uncaughtException",
  });
  await closeDatabases();
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  const error = reason instanceof Error ? reason : new Error(normalizeText(reason) || "Unhandled non-error rejection");
  console.error("Unhandled Rejection:", error);
  await alertError({
    error,
    status: 500,
    requestId: "unhandledRejection",
  });
  await closeDatabases();
  process.exit(1);
});

startServer();
