const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadModule } = require("./helpers/loadModule");

test("NZ Post merges concurrent token requests and ignores late rejections of an old token", async () => {
    let calls = 0;
    const service = loadModule("services/nzPostTokenService.js", {
        "../config/envConfig": { nzPost: {
            clientId: "test", clientSecret: "test", tokenUrl: "https://token.example",
            tokenRefreshBufferSeconds: 60, tokenFallbackTtlSeconds: 1800,
        } },
        "../utils/httpJson": { requestJson: async () => ({ access_token: `token-${++calls}`, expires_in: 3600 }) },
    });
    const tokens = await Promise.all(Array.from({ length: 8 }, () => service.getNZPostAccessToken()));
    assert.equal(calls, 1);
    assert.ok(tokens.every((token) => token.accessToken === "token-1"));
    await service.getNZPostAccessToken({ forceRefresh: true, rejectedToken: "token-1" });
    const current = await service.getNZPostAccessToken({ forceRefresh: true, rejectedToken: "token-1" });
    assert.equal(current.accessToken, "token-2");
    assert.equal(calls, 2);
});

test("OneDrive shares OAuth and folder lookups across concurrent uploads", async () => {
    let tokens = 0;
    let lookups = 0;
    const service = loadModule("services/oneDriveUploadService.js", {
        "../config/envConfig": { oneDrive: {
            clientId: "test", clientSecret: "test", refreshToken: "test", redirectUri: "https://example.com",
            tokenUrl: "https://token.example", tokenRefreshBufferSeconds: 60, uploadRoot: "",
        } },
        "./r2UploadService": { validateFileForR2: () => {} },
        "../utils/httpJson": { requestJson: async (options) => {
            if (options.url === "https://token.example") return { access_token: `token-${++tokens}`, expires_in: 3600 };
            if (options.method === "PUT") return { id: "uploaded" };
            lookups += 1;
            return { id: "folder" };
        } },
    });
    const options = { file: { originalname: "photo.jpg", buffer: Buffer.from("test") }, claimType: "promotions", slug: 7 };
    const files = await Promise.all([service.uploadFileToOneDrive(options), service.uploadFileToOneDrive(options)]);
    assert.equal(tokens, 1);
    assert.equal(lookups, 3);
    assert.notEqual(files[0].file_name, files[1].file_name);
    await service.uploadFileToOneDrive(options);
    assert.equal(lookups, 3);
});

test("all mail services can reuse a bounded SMTP connection pool", () => {
    let created = 0;
    let closed = 0;
    const service = loadModule("services/mailService.js", {
        "../config/envConfig": { email: { host: "test", port: 465, user: "test", pass: "test", from: "test@example.com" } },
        nodemailer: { createTransport: (options) => {
            created += 1;
            assert.equal(options.pool, true);
            assert.equal(options.secure, true);
            assert.equal(options.maxConnections, 3);
            assert.equal(options.disableFileAccess, true);
            return { close: () => { closed += 1; } };
        } },
    });
    assert.equal(service.getTransporter(), service.getTransporter());
    assert.equal(created, 1);
    service.closeMailTransporter();
    assert.equal(closed, 1);
});

test("event templates are cached before rendering and replacements preserve dollar signs", async () => {
    let fetched = 0;
    const messages = [];
    const service = loadModule("services/eventConfirmationEmailService.js", {
        "../config/envConfig": { r2: { publicBaseUrl: "https://assets.example" }, email: { from: "test@example.com" } },
        "../models": { models: { active: {} } },
        "./mailService": { isEmailConfigured: () => true, getTransporter: () => ({ sendMail: async (mail) => messages.push(mail) }) },
        "../utils/httpJson": { requestJson: async () => {
            fetched += 1;
            return { subject: "Hello {{full_name}}", body: ["Hi {{full_name}}"] };
        } },
        "./logService": { writeLog: async () => {} },
    });
    await Promise.all(["Alice", "$& Bob"].map((fullName) => service.sendEventConfirmationEmail({
        slugUrl: "event", fullName, recipientEmail: "test@example.com",
    })));
    assert.equal(fetched, 1);
    assert.deepEqual(messages.map((mail) => mail.text).sort(), ["Hi $& Bob", "Hi Alice"]);
});
