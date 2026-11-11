const { normalizeText } = require("./text");

const buildAssetUrl = (baseUrl, folder, fileName) => {
    if (!normalizeText(fileName)) return null;
    return [baseUrl, folder, fileName]
        .map((part) => normalizeText(part).replace(/^\/+|\/+$/g, ""))
        .filter(Boolean).join("/");
};

module.exports = { buildAssetUrl };
