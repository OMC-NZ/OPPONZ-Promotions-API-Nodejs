const path = require("path");
const config = require("../config/envConfig");
const { validateFileForR2 } = require("./r2UploadService");
const { buildClaimObjectKey, normalizeClaimType, normalizePathSegment } = require("../utils/claimFilePolicy");
const { requestJson } = require("../utils/httpJson");
const { ExpiringCache } = require("../utils/expiringCache");

let cachedAccessToken;
let cachedAccessTokenExpiresAt = 0;
let pendingTokenRequest;
let refreshToken = config.oneDrive.refreshToken;
const folderCache = new ExpiringCache({ maxEntries: 256 });
const pendingFolders = new Map();

const assertOneDriveConfig = () => {
    const missing = [];

    if (!config.oneDrive.clientId) missing.push("ONEDRIVE_CLIENT_ID");
    if (!config.oneDrive.clientSecret) missing.push("ONEDRIVE_CLIENT_SECRET");
    if (!config.oneDrive.refreshToken) missing.push("ONEDRIVE_REFRESH_TOKEN");
    if (!config.oneDrive.redirectUri) missing.push("ONEDRIVE_REDIRECT_URI");

    if (missing.length > 0) {
        const error = new Error(`OneDrive configuration is incomplete: ${missing.join(", ")}`);
        error.statusCode = 500;
        throw error;
    }
};

const joinOneDrivePath = (...parts) => {
    return parts
        .map((part) => String(part || "").trim().replace(/^\/+|\/+$/g, ""))
        .filter(Boolean)
        .join("/");
};

const buildOneDriveObjectPath = ({ claimType, slug, originalName }) => {
    return joinOneDrivePath(config.oneDrive.uploadRoot, buildClaimObjectKey({ claimType, slug, originalName }));
};

const getFolderPath = (objectPath) => {
    const parts = String(objectPath || "").split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
};

const getCachedAccessToken = () => {
    const now = Date.now();
    const refreshBufferMs = config.oneDrive.tokenRefreshBufferSeconds * 1000;

    if (cachedAccessToken && now < cachedAccessTokenExpiresAt - refreshBufferMs) {
        return cachedAccessToken;
    }

    return null;
};

const requestOneDriveAccessToken = async () => {
    assertOneDriveConfig();

    const cachedToken = getCachedAccessToken();
    if (cachedToken) return cachedToken;

    const body = new URLSearchParams({
        client_id: config.oneDrive.clientId,
        client_secret: config.oneDrive.clientSecret,
        redirect_uri: config.oneDrive.redirectUri,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });

    const tokenData = await requestJson({
        url: config.oneDrive.tokenUrl,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        label: "OneDrive token endpoint",
        maxResponseBytes: 64 * 1024,
    });

    if (!tokenData.access_token) {
        const error = new Error("OneDrive token response does not include access_token.");
        error.statusCode = 502;
        throw error;
    }

    cachedAccessToken = tokenData.access_token;
    cachedAccessTokenExpiresAt = Date.now() + Number(tokenData.expires_in || 3600) * 1000;
    if (typeof tokenData.refresh_token === "string") refreshToken = tokenData.refresh_token;

    return cachedAccessToken;
};

const getOneDriveAccessToken = async ({ rejectedToken } = {}) => {
    const cached = getCachedAccessToken();
    if (cached && cached !== rejectedToken) return cached;
    if (rejectedToken === cachedAccessToken) cachedAccessToken = undefined;
    if (!pendingTokenRequest) {
        pendingTokenRequest = requestOneDriveAccessToken().finally(() => { pendingTokenRequest = undefined; });
    }
    return pendingTokenRequest;
};

const encodeDrivePath = (value) => value.split("/").map(encodeURIComponent).join("/");

const getOneDriveItemByPath = async ({ accessToken, itemPath }) => {
    const cleanPath = String(itemPath || "").trim().replace(/^\/+|\/+$/g, "");
    const url = cleanPath
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeDrivePath(cleanPath)}`
        : "https://graph.microsoft.com/v1.0/me/drive/root";
    try {
        return await requestJson({ url, headers: { Authorization: `Bearer ${accessToken}` }, label: "OneDrive folder lookup" });
    } catch (error) {
        if (error.statusCode === 404) return null;
        throw error;
    }
};

const createOneDriveFolder = async ({ accessToken, parentPath, folderName }) => {
    const cleanParentPath = String(parentPath || "").trim().replace(/^\/+|\/+$/g, "");
    const url = cleanParentPath
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeDrivePath(cleanParentPath)}:/children`
        : "https://graph.microsoft.com/v1.0/me/drive/root/children";
    try {
        return await requestJson({
            url,
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ name: folderName, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
            label: "OneDrive folder creation",
        });
    } catch (error) {
        if (error.statusCode === 409) return getOneDriveItemByPath({
            accessToken, itemPath: joinOneDrivePath(parentPath, folderName),
        });
        throw error;
    }
};

const ensureOneDriveFolderPath = async ({ accessToken, folderPath }) => {
    if (folderCache.get(folderPath)) return;
    if (pendingFolders.has(folderPath)) return pendingFolders.get(folderPath);
    const pending = createOneDriveFolderPath({ accessToken, folderPath })
        .then(() => folderCache.set(folderPath, true, 5 * 60 * 1000))
        .finally(() => pendingFolders.delete(folderPath));
    pendingFolders.set(folderPath, pending);
    return pending;
};

const createOneDriveFolderPath = async ({ accessToken, folderPath }) => {
    const parts = String(folderPath || "").split("/").filter(Boolean);
    let currentPath = "";

    for (const part of parts) {
        const nextPath = joinOneDrivePath(currentPath, part);
        const existingFolder = await getOneDriveItemByPath({
            accessToken,
            itemPath: nextPath,
        });

        if (!existingFolder) {
            await createOneDriveFolder({
                accessToken,
                parentPath: currentPath,
                folderName: part,
            });
        }

        currentPath = nextPath;
    }
};

const uploadFileToOneDrive = async ({ file, claimType = "promotions", slug }) => {
    validateFileForR2(file);

    let accessToken = await getOneDriveAccessToken();
    const objectPath = buildOneDriveObjectPath({
        claimType,
        slug,
        originalName: file.originalname,
    });

    const folderPath = getFolderPath(objectPath);
    try {
        await ensureOneDriveFolderPath({ accessToken, folderPath });
    } catch (error) {
        if (error.statusCode !== 401) throw error;
        accessToken = await getOneDriveAccessToken({ rejectedToken: accessToken });
        await ensureOneDriveFolderPath({ accessToken, folderPath });
    }

    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeDrivePath(objectPath)}:/content`;
    const sendUpload = (token) => requestJson({
        url: uploadUrl,
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": file.mimetype || "application/octet-stream",
        },
        body: file.buffer,
        timeoutMs: 20000,
        label: "OneDrive upload",
    });
    let uploadedItem;
    try {
        uploadedItem = await sendUpload(accessToken);
    } catch (error) {
        if (error.statusCode !== 401) throw error;
        uploadedItem = await sendUpload(await getOneDriveAccessToken({ rejectedToken: accessToken }));
    }

    return {
        key: objectPath,
        id: uploadedItem.id,
        name: uploadedItem.name,
        file_name: uploadedItem.name || path.basename(objectPath),
        web_url: uploadedItem.webUrl,
        original_name: file.originalname,
        content_type: file.mimetype,
        size: file.size,
        claim_type: normalizeClaimType(claimType),
        slug: normalizePathSegment(slug),
    };
};

module.exports = {
    getOneDriveAccessToken,
    uploadFileToOneDrive,
};
