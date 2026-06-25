const https = require("https");
const { URL } = require("url");
const config = require("../config/envConfig");
const { getNZPostAccessToken } = require("./nzPostTokenService");

const DEFAULT_MAX_RESULTS = 100;

const requestJson = ({ url, token }) => {
    const requestUrl = new URL(url);
    const options = {
        hostname: requestUrl.hostname,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        method: "GET",
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept: "application/json",
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
                    reject(new Error("Invalid JSON returned by NZ Post address checker."));
                    return;
                }

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    const error = new Error(`NZ Post address checker returned HTTP ${response.statusCode}`);
                    error.statusCode = response.statusCode;
                    error.response = parsedBody;
                    reject(error);
                    return;
                }

                resolve(parsedBody);
            });
        });

        request.on("timeout", () => {
            request.destroy(new Error("NZ Post address checker request timed out."));
        });
        request.on("error", reject);
        request.end();
    });
};

const isTokenError = (error) => error?.statusCode === 401 || error?.statusCode === 403;

const requestAddressSearch = async (requestUrl) => {
    const token = await getNZPostAccessToken();

    try {
        return await requestJson({
            url: requestUrl.toString(),
            token,
        });
    } catch (error) {
        if (!isTokenError(error)) throw error;

        const refreshedToken = await getNZPostAccessToken({ forceRefresh: true });
        return requestJson({
            url: requestUrl.toString(),
            token: refreshedToken,
        });
    }
};

const getFirstNonNullField = (addresses, fieldName) => {
    const matchedAddress = addresses.find((address) => address?.[fieldName] !== null && address?.[fieldName] !== undefined);
    return matchedAddress ? matchedAddress[fieldName] : null;
};

const pickAddressDetailFields = (address, addresses) => ({
    BoxBagType: address?.BoxBagType,
    BoxBagNumber: address?.BoxBagNumber,
    UnitType: address?.UnitType,
    UnitValue: address?.UnitValue,
    Floor: address?.Floor,
    StreetNumber: address?.StreetNumber,
    StreetAlpha: address?.StreetAlpha,
    RoadName: address?.RoadName,
    RoadTypeName: address?.RoadTypeName,
    RoadSuffixName: address?.RoadSuffixName,
    Suburb: getFirstNonNullField(addresses, "Suburb"),
    Lobby: address?.Lobby,
    CityTown: getFirstNonNullField(addresses, "CityTown"),
    RuralDelivery: getFirstNonNullField(addresses, "RuralDelivery"),
    Postcode: address?.Postcode,
});

const searchNZPostAddresses = async ({ query }) => {
    const trimmedQuery = String(query || "").trim();
    if (!trimmedQuery) {
        const error = new Error("Address search text is required.");
        error.statusCode = 400;
        throw error;
    }

    const requestUrl = new URL(`${config.nzPost.addressCheckerUrl.replace(/\/+$/, "")}/suggest`);
    requestUrl.searchParams.set("q", trimmedQuery);
    requestUrl.searchParams.set("max", String(DEFAULT_MAX_RESULTS));

    const response = await requestAddressSearch(requestUrl);

    return {
        status: response.status,
        addresses: Array.isArray(response.addresses)
            ? response.addresses.map((address) => ({
                DPID: address.DPID,
                FullAddress: address.FullAddress,
            }))
            : [],
    };
};

const autocompleteNZPostAddress = async ({ dpid }) => {
    const trimmedDpid = String(dpid || "").trim();
    if (!trimmedDpid) {
        const error = new Error("DPID is required.");
        error.statusCode = 400;
        throw error;
    }

    const requestUrl = new URL(`${config.nzPost.addressCheckerUrl.replace(/\/+$/, "")}/details`);
    requestUrl.searchParams.set("dpid", trimmedDpid);

    const response = await requestAddressSearch(requestUrl);
    const addresses = Array.isArray(response.details)
        ? response.details
        : Array.isArray(response.addresses)
            ? response.addresses
            : [response.address || response.details || response].filter(Boolean);
    const address = addresses.find((item) => item?.RuralDelivery !== null) || addresses[0];

    return {
        status: response.status,
        address: address ? pickAddressDetailFields(address, addresses) : null,
    };
};

module.exports = {
    searchNZPostAddresses,
    autocompleteNZPostAddress,
};
