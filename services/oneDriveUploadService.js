const crypto = require("crypto");
const path = require("path");
const config = require("../config/envConfig");
const { validateFileForR2 } = require("./r2UploadService");

const claimUploadFolders = {
    promotions: "claims/promotions",
    events: "claims/events",
};

let cachedAccessToken;
let cachedAccessTokenExpiresAt = 0;

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

const normalizeClaimType = (claimType) => {
    const key = String(claimType || "").trim().toLowerCase();
    return claimUploadFolders[key] ? key : "promotions";
};

const normalizePathSegment = (value, label) => {
    const text = String(value || "").trim().replace(/^\/+|\/+$/g, "");

    if (!text || text.includes("..") || /[\\/]/.test(text)) {
        const error = new Error(`OneDrive ${label} is required.`);
        error.statusCode = 500;
        throw error;
    }

    return text;
};

const getSafeExtension = (originalName) => {
    return path.extname(String(originalName || "")).toLowerCase();
};

const joinOneDrivePath = (...parts) => {
    return parts
        .map((part) => String(part || "").trim().replace(/^\/+|\/+$/g, ""))
        .filter(Boolean)
        .join("/");
};

const buildOneDriveObjectPath = ({ claimType, slug, originalName }) => {
    const folder = claimUploadFolders[normalizeClaimType(claimType)];
    const slugSegment = normalizePathSegment(slug, "slug");
    const extension = getSafeExtension(originalName);
    const fileName = `${crypto.randomUUID()}${extension}`;

    return joinOneDrivePath(config.oneDrive.uploadRoot, folder, slugSegment, fileName);
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

const getOneDriveAccessToken = async () => {
    assertOneDriveConfig();

    const cachedToken = getCachedAccessToken();
    if (cachedToken) return cachedToken;

    const body = new URLSearchParams({
        client_id: config.oneDrive.clientId,
        client_secret: config.oneDrive.clientSecret,
        redirect_uri: config.oneDrive.redirectUri,
        grant_type: "refresh_token",
        refresh_token: config.oneDrive.refreshToken,
    });

    const response = await fetch(config.oneDrive.tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    const responseText = await response.text();

    if (!response.ok) {
        const error = new Error(`OneDrive token endpoint returned HTTP ${response.status}`);
        error.statusCode = 502;
        error.responsePreview = responseText.slice(0, 300);
        throw error;
    }

    let tokenData;

    try {
        tokenData = JSON.parse(responseText);
    } catch (error) {
        error.message = `Failed to parse OneDrive token response JSON: ${error.message}`;
        error.statusCode = 502;
        throw error;
    }

    if (!tokenData.access_token) {
        const error = new Error("OneDrive token response does not include access_token.");
        error.statusCode = 502;
        throw error;
    }

    cachedAccessToken = tokenData.access_token;
    cachedAccessTokenExpiresAt = Date.now() + Number(tokenData.expires_in || 3600) * 1000;

    return cachedAccessToken;
};

const getOneDriveItemByPath = async ({ accessToken, itemPath }) => {
    const cleanPath = String(itemPath || "").trim().replace(/^\/+|\/+$/g, "");
    const url = cleanPath
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(cleanPath)}`
        : "https://graph.microsoft.com/v1.0/me/drive/root";
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (response.status === 404) return null;

    const responseText = await response.text();

    if (!response.ok) {
        const error = new Error(`OneDrive folder lookup failed: HTTP ${response.status}`);
        error.statusCode = 502;
        error.responsePreview = responseText.slice(0, 300);
        throw error;
    }

    return JSON.parse(responseText);
};

const createOneDriveFolder = async ({ accessToken, parentPath, folderName }) => {
    const cleanParentPath = String(parentPath || "").trim().replace(/^\/+|\/+$/g, "");
    const url = cleanParentPath
        ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(cleanParentPath)}:/children`
        : "https://graph.microsoft.com/v1.0/me/drive/root/children";
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: folderName,
            folder: {},
            "@microsoft.graph.conflictBehavior": "fail",
        }),
    });
    const responseText = await response.text();

    if (response.status === 409) {
        return getOneDriveItemByPath({
            accessToken,
            itemPath: joinOneDrivePath(parentPath, folderName),
        });
    }

    if (!response.ok) {
        const error = new Error(`OneDrive folder creation failed: HTTP ${response.status}`);
        error.statusCode = 502;
        error.responsePreview = responseText.slice(0, 300);
        throw error;
    }

    return JSON.parse(responseText);
};

const ensureOneDriveFolderPath = async ({ accessToken, folderPath }) => {
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

    const accessToken = await getOneDriveAccessToken();
    const objectPath = buildOneDriveObjectPath({
        claimType,
        slug,
        originalName: file.originalname,
    });

    await ensureOneDriveFolderPath({
        accessToken,
        folderPath: getFolderPath(objectPath),
    });

    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(objectPath)}:/content`;
    const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": file.mimetype || "application/octet-stream",
        },
        body: file.buffer,
    });
    const responseText = await response.text();

    if (!response.ok) {
        const error = new Error(`OneDrive upload failed: HTTP ${response.status}`);
        error.statusCode = 502;
        error.responsePreview = responseText.slice(0, 300);
        throw error;
    }

    let uploadedItem;

    try {
        uploadedItem = JSON.parse(responseText);
    } catch (error) {
        error.message = `Failed to parse OneDrive upload response JSON: ${error.message}`;
        error.statusCode = 502;
        throw error;
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
        slug: normalizePathSegment(slug, "slug"),
    };
};

module.exports = {
    getOneDriveAccessToken,
    uploadFileToOneDrive,
};
