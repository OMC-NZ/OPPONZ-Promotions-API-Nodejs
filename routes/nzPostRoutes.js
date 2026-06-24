const express = require("express");
const {
    autocompleteNZPostAddress,
    getNZPostToken,
    searchNZPostAddresses,
} = require("../controllers/nzPostController");
const { methodNotAllowed } = require("../middlewares/routeSecurity");

const router = express.Router();

router.route("/token")
    .get(getNZPostToken)
    .all(methodNotAllowed(["GET"]));

router.route("/address/search")
    .get(searchNZPostAddresses)
    .all(methodNotAllowed(["GET"]));

router.route("/address/autocomplete")
    .get(autocompleteNZPostAddress)
    .all(methodNotAllowed(["GET"]));

module.exports = router;
