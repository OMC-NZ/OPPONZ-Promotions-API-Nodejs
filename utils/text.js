const toScalarText = (value) => {
    return ["string", "number", "boolean", "bigint"].includes(typeof value)
        ? String(value)
        : null;
};

const normalizeText = (value) => (toScalarText(value) || "").trim();

const joinText = (values, separator = " ") => values.map(normalizeText).filter(Boolean).join(separator);

const formatGiftName = (gift) => joinText([gift?.name, gift?.color]);

const escapeHtml = (value) => (toScalarText(value) || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

module.exports = { toScalarText, normalizeText, joinText, formatGiftName, escapeHtml };
