const { getNewZealandTime } = require("./nzTimeZone");

let installed = false;

const timestampPrefixPattern = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/;

const addTimestampToConsoleMethod = (methodName) => {
    const originalMethod = console[methodName].bind(console);

    console[methodName] = (...args) => {
        if (typeof args[0] === "string" && timestampPrefixPattern.test(args[0])) {
            originalMethod(...args);
            return;
        }

        originalMethod(`[${getNewZealandTime()}]`, ...args);
    };
};

const installConsoleTimestamp = () => {
    if (installed) return;

    ["log", "warn", "error"].forEach(addTimestampToConsoleMethod);
    installed = true;
};

module.exports = {
    installConsoleTimestamp,
};
