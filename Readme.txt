If .env and .env.* is updated, they need add manually to server. Because they have been set then not uploaded to Git Hub.

Use getEnv and getDev to respectively call variables from .env and .env.development files.
const config = require("./config/env");
// Retrieve common configurations (variables in the .env file)
console.log("DB_HOST (from .env):", config.getEnv("DB_HOST"));

