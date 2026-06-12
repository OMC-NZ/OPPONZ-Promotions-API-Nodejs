const express = require("express");
const cors = require("cors");
const getCorsOptions = require("./config/corsConfig");
const config = require("./config/envConfig");
const { connectDatabase, testConnection, closeDatabases } = require("./config/dbConfig");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(getCorsOptions()));

const isDevelopment = process.env.NODE_ENV === "development";
const PORT = config.app.port || (isDevelopment ? 3000 : 80);
let server;

const startServer = async () => {
  try {
    connectDatabase();
    await testConnection();

    const routes = require("./routes");
    app.use(routes);

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
