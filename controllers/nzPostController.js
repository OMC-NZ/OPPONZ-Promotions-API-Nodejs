const config = require("../config/envConfig");
const { fetchNZPostTokenResponse } = require("../services/nzPostTokenService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const getNZPostToken = async (req, res) => {
    try {
        const tokenResponse = await fetchNZPostTokenResponse();
        const responseFields = Object.keys(tokenResponse || {});

        if (config.environment === "production") {
            return sendSuccess(req, res, {
                data: {
                    token_type: tokenResponse.token_type,
                    expires_in: tokenResponse.expires_in,
                    response_fields: responseFields,
                },
            });
        }

        return sendSuccess(req, res, {
            data: tokenResponse,
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

module.exports = {
    getNZPostToken,
};
