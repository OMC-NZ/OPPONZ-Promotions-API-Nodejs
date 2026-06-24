const https = require("https");
const { URL } = require("url");
const config = require("../config/envConfig");

let cachedToken = null;
let pendingTokenRequest = null;

const maskToken = (token) => {
    if (!token || typeof token !== "string") return token;
    if (token.length <= 10) return "********";

    return `${token.slice(0, 4)}...${token.slice(-4)}`;
};

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

    const tokenUrl = new URL(config.nzPost.tokenUrl);
    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.nzPost.clientId,
        client_secret: config.nzPost.clientSecret,
    }).toString();

    const options = {
        hostname: tokenUrl.hostname,
        path: `${tokenUrl.pathname}${tokenUrl.search}`,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(body),
        },
        timeout: 10000,
    };

    return new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
            let responseBody = "";

            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                responseBody += chunk;
            });
            response.on("end", () => {
                let parsedBody;

                try {
                    parsedBody = responseBody ? JSON.parse(responseBody) : {};
                } catch (error) {
                    reject(new Error("Invalid JSON returned by NZ Post token endpoint."));
                    return;
                }

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    const error = new Error(`NZ Post token endpoint returned HTTP ${response.statusCode}`);
                    error.statusCode = response.statusCode;
                    error.response = parsedBody;
                    reject(error);
                    return;
                }

                resolve(parsedBody);
            });
        });

        request.on("timeout", () => {
            request.destroy(new Error("NZ Post token request timed out."));
        });
        request.on("error", reject);
        request.write(body);
        request.end();
    });
};

const fetchNZPostTokenResponse = async () => {
    return postTokenRequest();
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
    if (!options.forceRefresh && isCachedTokenValid()) {
        return cachedToken;
    }

    return refreshNZPostToken();
};

const clearNZPostTokenCache = () => {
    cachedToken = null;
};

const getNZPostTokenCacheInfo = () => {
    if (!cachedToken) {
        return {
            cached: false,
        };
    }

    return {
        cached: true,
        tokenType: cachedToken.tokenType,
        accessToken: maskToken(cachedToken.accessToken),
        expiresAt: new Date(cachedToken.expiresAt).toISOString(),
        expiresInSeconds: Math.max(0, Math.floor((cachedToken.expiresAt - Date.now()) / 1000)),
        responseFields: Object.keys(cachedToken.rawResponse || {}),
    };
};

module.exports = {
    fetchNZPostTokenResponse,
    getNZPostAccessToken,
    clearNZPostTokenCache,
    getNZPostTokenCacheInfo,
};
