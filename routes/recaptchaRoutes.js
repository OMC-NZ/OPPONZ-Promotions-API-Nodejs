const express = require("express");
const { verifyRecaptcha } = require("../controllers/recaptchaController");

const router = express.Router();

router.post("/verify", verifyRecaptcha);

module.exports = router;
