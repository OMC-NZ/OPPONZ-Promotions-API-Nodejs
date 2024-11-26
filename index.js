const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

// Middlewares
app.use(express.json());  //parse the JSON format request body
app.use(express.urlencoded({extended: true}));
app.use(cors());

//determine environment
const isDevelopment = process.env.NODE_ENV === "development";

// Start Project
const PORT = isDevelopment ? 3000 : 80;
app.listen(PORT, () => {
    console.log(`Server is running on the port: ${PORT}`);
});
