const express = require("express");
const {
    autocompleteNZPostAddress,
    searchNZPostAddresses,
} = require("../controllers/nzPostController");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { methodNotAllowed } = require("../middlewares/routeSecurity");

const router = express.Router();

router.route("/address/search")
    .get(requireRecaptcha({ action: "address_search" }), searchNZPostAddresses)
    .all(methodNotAllowed(["GET"]));

router.route("/address/autocomplete")
    .get(requireRecaptcha({ action: "address_autocomplete" }), autocompleteNZPostAddress)
    .all(methodNotAllowed(["GET"]));

module.exports = router;
