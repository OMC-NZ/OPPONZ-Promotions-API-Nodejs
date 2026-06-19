const path = require("path");

const normalizeStackLine = (line) => line.trim().replace(process.cwd(), ".");

const getStackLines = (error) => {
    if (!error?.stack) return [];
    return String(error.stack)
        .split(/\r?\n/)
        .slice(1)
        .map(normalizeStackLine)
        .filter(Boolean);
};

const getErrorLocation = (error) => {
    const stackLines = getStackLines(error);
    const projectLine = stackLines.find((line) => {
        return line.includes(`.${path.sep}`) && !line.includes(`${path.sep}node_modules${path.sep}`);
    });

    return projectLine || stackLines[0] || "N/A";
};

module.exports = {
    getStackLines,
    getErrorLocation,
};
