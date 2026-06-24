const config = require("../config/envConfig");
const {
    autocompleteNZPostAddress,
    searchNZPostAddresses,
} = require("../services/nzPostAddressService");
const { getNZPostAccessToken } = require("../services/nzPostTokenService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const getNZPostToken = async (req, res) => {
    try {
        const token = await getNZPostAccessToken();
        const tokenResponse = token.rawResponse || {};
        const responseFields = Object.keys(tokenResponse || {});
        const expiresInSeconds = Math.max(0, Math.floor((token.expiresAt - Date.now()) / 1000));

        if (config.environment === "production") {
            return sendSuccess(req, res, {
                data: {
                    token_type: token.tokenType,
                    expires_at: new Date(token.expiresAt).toISOString(),
                    expires_in_seconds: expiresInSeconds,
                    response_fields: responseFields,
                },
            });
        }

        return sendSuccess(req, res, {
            data: {
                ...tokenResponse,
                expires_at: new Date(token.expiresAt).toISOString(),
                expires_in_seconds: expiresInSeconds,
            },
        });
    } catch (error) {
        console.error("Error getting NZ Post token:", error);
        return sendError(req, res, {
            statusCode: error.statusCode || 502,
            message: "Failed to get NZ Post token.",
            code: "NZ_POST_TOKEN_ERROR",
            debug: {
                message: error.message,
                response: error.response,
            },
        });
    }
};

const searchNZPostAddressesController = async (req, res) => {
    try {
        const result = await searchNZPostAddresses({
            query: req.query.q,
        });

        return res.status(200).json({
            success: true,
            addresses: result.addresses,
            status: result.status || "success",
            requestId: req.requestId,
        });
    } catch (error) {
        console.error("Error searching NZ Post addresses:", error);
        return sendError(req, res, {
            statusCode: error.statusCode || 502,
            message: error.statusCode === 400
                ? "Please enter an address to search."
                : "Failed to get address suggestions.",
            code: "NZ_POST_ADDRESS_SEARCH_ERROR",
            debug: {
                message: error.message,
                response: error.response,
            },
        });
    }
};

const autocompleteNZPostAddressController = async (req, res) => {
    try {
        const result = await autocompleteNZPostAddress({
            dpid: req.query.dpid,
        });

        return res.status(200).json({
            success: true,
            address: result.address,
            status: result.status || "success",
            requestId: req.requestId,
        });
    } catch (error) {
        console.error("Error getting NZ Post address details:", error);
        return sendError(req, res, {
            statusCode: error.statusCode || 502,
            message: error.statusCode === 400
                ? "Please select a valid address."
                : "Failed to get address details.",
            code: "NZ_POST_ADDRESS_AUTOCOMPLETE_ERROR",
            debug: {
                message: error.message,
                response: error.response,
            },
        });
    }
};

module.exports = {
    autocompleteNZPostAddress: autocompleteNZPostAddressController,
    getNZPostToken,
    searchNZPostAddresses: searchNZPostAddressesController,
};
