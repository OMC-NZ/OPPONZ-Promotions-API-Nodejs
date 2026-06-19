const express = require("express");
const { verifyRecaptcha } = require("../controllers/recaptchaController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");

const router = express.Router();

router.route("/verify")
    .post(verifyRecaptcha)
    .all(methodNotAllowed(["POST"]));

module.exports = router;
