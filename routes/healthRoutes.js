const express = require("express");
const { getHealth, getIpDebug } = require("../controllers/healthController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");

const router = express.Router();

router.route("/")
    .get(getHealth)
    .all(methodNotAllowed(["GET"]));

router.route("/ip")
    .get(getIpDebug)
    .all(methodNotAllowed(["GET"]));

module.exports = router;
