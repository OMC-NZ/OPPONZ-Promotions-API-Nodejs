const { randomInt } = require("crypto");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const generateUniqueClaimId = async ({ model, prefix, dateTime, transaction }) => {
    const datePart = `${dateTime.slice(2, 4)}${dateTime.slice(5, 7)}${dateTime.slice(8, 10)}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const suffix = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
        const claimId = `${prefix}-${datePart}-${suffix}`;
        if (!await model.findByPk(claimId, { transaction })) return claimId;
    }

    throw new Error("Failed to generate a unique claim ID.");
};

module.exports = { generateUniqueClaimId };
