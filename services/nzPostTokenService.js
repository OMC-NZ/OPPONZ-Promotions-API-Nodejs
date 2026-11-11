const { requestJson } = require("../utils/httpJson");
const config = require("../config/envConfig");

let cachedToken = null;
let pendingTokenRequest = null;

const getTokenExpiry = (tokenResponse) => {
    const expiresIn = Number.parseInt(tokenResponse.expires_in, 10);
    const ttlSeconds = Number.isNaN(expiresIn) ? config.nzPost.tokenFallbackTtlSeconds : expiresIn;
    const refreshBufferMs = config.nzPost.tokenRefreshBufferSeconds * 1000;

    return Date.now() + (ttlSeconds * 1000) - refreshBufferMs;
};

const isCachedTokenValid = () => {
    return cachedToken && cachedToken.accessToken && cachedToken.expiresAt > Date.now();
};

const assertNZPostConfig = () => {
    if (!config.nzPost.clientId || !config.nzPost.clientSecret) {
        throw new Error("NZ Post OAuth configuration is incomplete.");
    }
};

const postTokenRequest = () => {
    assertNZPostConfig();

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.nzPost.clientId,
        client_secret: config.nzPost.clientSecret,
    }).toString();

    return requestJson({
        url: config.nzPost.tokenUrl,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        label: "NZ Post token endpoint",
        maxResponseBytes: 64 * 1024,
    });
};

const saveTokenToCache = (tokenResponse) => {
    if (!tokenResponse || !tokenResponse.access_token) {
        throw new Error("NZ Post token response does not include access_token.");
    }

    cachedToken = {
        accessToken: tokenResponse.access_token,
        tokenType: tokenResponse.token_type || "Bearer",
        expiresAt: getTokenExpiry(tokenResponse),
        rawResponse: tokenResponse,
    };

    return cachedToken;
};

const refreshNZPostToken = async () => {
    if (!pendingTokenRequest) {
        pendingTokenRequest = postTokenRequest()
            .then(saveTokenToCache)
            .finally(() => {
                pendingTokenRequest = null;
            });
    }

    return pendingTokenRequest;
};

const getNZPostAccessToken = async (options = {}) => {
    if (options.rejectedToken && isCachedTokenValid() && cachedToken.accessToken !== options.rejectedToken) {
        return cachedToken;
    }
    if (!options.forceRefresh && isCachedTokenValid()) {
        return cachedToken;
    }

    return refreshNZPostToken();
};

const clearNZPostTokenCache = () => {
    cachedToken = null;
};

module.exports = {
    getNZPostAccessToken,
    clearNZPostTokenCache,
};
