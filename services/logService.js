const fs = require("fs/promises");
const path = require("path");
const config = require("../config/envConfig");
const { getNewZealandTime } = require("../utils/nzTimeZone");
const { redactSensitiveData } = require("../utils/redactSensitiveData");

const logDirectory = path.resolve(__dirname, "..", config.logs.directory);
let cleanupTimer;

const logTypeDirectories = {
    request: {
        directory: "requests",
        prefix: "req",
    },
    error: {
        directory: "errors",
        prefix: "err",
    },
    security: {
        directory: "security",
        prefix: "sec",
    },
};

const getLogTypeConfig = (type) => {
    return logTypeDirectories[type] || logTypeDirectories.request;
};

const getLogFilePath = (type, date = new Date()) => {
    const datePart = date.toISOString().slice(0, 10);
    const typeConfig = getLogTypeConfig(type);
    return path.join(logDirectory, typeConfig.directory, `${typeConfig.prefix}-${datePart}.log`);
};

const ensureLogDirectory = async (type) => {
    await fs.mkdir(path.join(logDirectory, getLogTypeConfig(type).directory), { recursive: true });
};

const writeLog = async (type, payload) => {
    const entry = {
        timestamp: getNewZealandTime(),
        type,
        ...redactSensitiveData(payload),
    };

    try {
        await ensureLogDirectory(type);
        await fs.appendFile(getLogFilePath(type), `${JSON.stringify(entry)}\n`, "utf8");
    } catch (error) {
        console.error("Failed to write log file:", error.message);
    }
};

const cleanupDirectory = async (type) => {
    const typeConfig = getLogTypeConfig(type);
    const directory = path.join(logDirectory, typeConfig.directory);
    await fs.mkdir(directory, { recursive: true });

    const files = await fs.readdir(directory);
    const cutoff = Date.now() - config.logs.retentionDays * 24 * 60 * 60 * 1000;
    const logFilePattern = new RegExp(`^${typeConfig.prefix}-\\d{4}-\\d{2}-\\d{2}\\.log$`);

    await Promise.all(files.map(async (file) => {
        if (!logFilePattern.test(file)) return;

        const fullPath = path.join(directory, file);
        const stats = await fs.stat(fullPath);

        if (stats.mtimeMs < cutoff) {
            await fs.unlink(fullPath);
        }
    }));
};

const cleanupOldLogs = async () => {
    try {
        await Promise.all(Object.keys(logTypeDirectories).map(cleanupDirectory));
    } catch (error) {
        console.error("Failed to clean up old logs:", error.message);
    }
};

const startLogCleanup = () => {
    cleanupOldLogs();

    if (cleanupTimer) return;
    cleanupTimer = setInterval(cleanupOldLogs, config.logs.cleanupIntervalMs);
    cleanupTimer.unref?.();
};

module.exports = {
    writeLog,
    cleanupOldLogs,
    startLogCleanup,
};
