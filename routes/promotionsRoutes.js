const express = require("express");
const { getCurrentPromotions } = require("../controllers/promotionsController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");

const router = express.Router();

router.route("/current")
    .get(getCurrentPromotions)
    .all(methodNotAllowed(["GET"]));

module.exports = router;
