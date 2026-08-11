const express = require("express");
const {
    autocompleteNZPostAddress,
    searchNZPostAddresses,
} = require("../controllers/nzPostController");
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");
const { methodNotAllowed } = require("../middlewares/routeSecurity");
const { validateRequest } = require("../middlewares/validateRequest");
const { required, recaptchaAction, stringLength } = require("../utils/validators");

const router = express.Router();

router.route("/address/search")
    .get(
        validateRequest({
            query: {
                q: [required(), stringLength({ max: 255 })],
                recaptcha_action: recaptchaAction(["address_search"]),
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
                recaptcha_action: recaptchaAction(["address_autocomplete"]),
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
