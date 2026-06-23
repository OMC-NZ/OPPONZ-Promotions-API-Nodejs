const express = require("express");
const { getNZPostToken } = require("../controllers/nzPostController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");

const router = express.Router();

router.route("/token")
    .get(getNZPostToken)
    .all(methodNotAllowed(["GET"]));

module.exports = router;
