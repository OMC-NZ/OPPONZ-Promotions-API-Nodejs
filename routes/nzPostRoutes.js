const express = require("express");
const {
    autocompleteNZPostAddress,
    searchNZPostAddresses,
} = require("../controllers/nzPostController");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { validateRequest } = require("../middlewares/validateRequest");
const { required, stringLength } = require("../utils/validators");

const router = express.Router();

router.route("/address/search")
    .get(
        validateRequest({
            query: {
                q: [required(), stringLength({ max: 255 })],
            },
        }, {
            message: "Please enter an address to search.",
            code: "NZ_POST_ADDRESS_SEARCH_VALIDATION_ERROR",
            includeDebug: false,
        }),
        requireRecaptcha({ action: "address_search" }),
        searchNZPostAddresses
    )
    .all(methodNotAllowed(["GET"]));

router.route("/address/autocomplete")
    .get(
        validateRequest({
            query: {
                dpid: [required(), stringLength({ max: 50 })],
            },
        }, {
            message: "Please select a valid address.",
            code: "NZ_POST_ADDRESS_AUTOCOMPLETE_VALIDATION_ERROR",
            includeDebug: false,
        }),
        requireRecaptcha({ action: "address_autocomplete" }),
        autocompleteNZPostAddress
    )
    .all(methodNotAllowed(["GET"]));

module.exports = router;
