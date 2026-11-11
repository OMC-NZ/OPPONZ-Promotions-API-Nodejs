const { requestJson } = require("../utils/httpJson");
const { normalizeText } = require("../utils/text");
const config = require("../config/envConfig");
const { getNZPostAccessToken } = require("./nzPostTokenService");

const DEFAULT_MAX_RESULTS = 100;

const requestAddressJson = ({ url, token }) => requestJson({
    url,
    headers: { Authorization: `Bearer ${token.accessToken}` },
    label: "NZ Post address checker",
});

const isTokenError = (error) => error?.statusCode === 401 || error?.statusCode === 403;

const requestAddressSearch = async (requestUrl) => {
    const token = await getNZPostAccessToken();

    try {
        return await requestAddressJson({
            url: requestUrl.toString(),
            token,
        });
    } catch (error) {
        if (!isTokenError(error)) throw error;

        const refreshedToken = await getNZPostAccessToken({ forceRefresh: true, rejectedToken: token.accessToken });
        return requestAddressJson({
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
    const trimmedQuery = normalizeText(query);
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
    const trimmedDpid = normalizeText(dpid);
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
    const address = addresses.find((item) => item?.RuralDelivery != null) || addresses[0];

    return {
        status: response.status,
        address: address ? pickAddressDetailFields(address, addresses) : null,
    };
};

module.exports = {
    searchNZPostAddresses,
    autocompleteNZPostAddress,
};
