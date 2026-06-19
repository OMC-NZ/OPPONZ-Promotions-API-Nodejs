const express = require("express");
const { getCurrentPromotions } = require("../controllers/promotionsController");

const router = express.Router();

router.get("/current", getCurrentPromotions);

module.exports = router;
