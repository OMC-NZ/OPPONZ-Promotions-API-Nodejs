const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadModule } = require("./helpers/loadModule");
const policy = require("../utils/claimFilePolicy");
const { redactSensitiveData } = require("../utils/redactSensitiveData");
const { buildAssetUrl } = require("../utils/assetUrl");

const makeFile = (mimetype, originalname, buffer) => ({ mimetype, originalname, buffer, size: buffer.length });

test("upload validation accepts supported signatures and rejects forged, mismatched, empty, and oversized files", () => {
    const files = [
        makeFile("image/jpeg", "photo.jpg", Buffer.from([0xff, 0xd8, 0xff, 0x01])),
        makeFile("image/png", "photo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        makeFile("application/pdf", "receipt.pdf", Buffer.from("%PDF-1.7\n")),
    ];
    for (const file of files) {
        assert.doesNotThrow(() => policy.validateClaimFile(file, 100));
        assert.throws(() => policy.validateClaimFile(file, 1), /too large/);
    }
    for (const file of [
        undefined, makeFile("image/jpeg", "photo.jpg", Buffer.alloc(0)),
        makeFile("image/jpeg", "photo.jpg", Buffer.from("<script>not a photo</script>")),
        { ...files[0], mimetype: "application/pdf" }, { ...files[0], originalname: "photo.heic" },
        { ...files[0], size: 100 },
    ]) assert.throws(() => policy.validateClaimFile(file, 100));
});

test("storage key builder keeps promotion IDs and UUID filenames and rejects unsafe folders", () => {
    const key = policy.buildClaimObjectKey({ claimType: "promotions", slug: 7, originalName: "receipt.JPG" });
    assert.match(key, /^claims\/promotions\/7\/[a-f0-9-]{36}\.jpg$/);
    for (const slug of ["", "../x", "x/y", "x?query", Object.create(null)]) {
        assert.throws(() => policy.buildClaimObjectKey({ slug, originalName: "x.jpg" }));
    }
    assert.throws(() => policy.buildClaimObjectKey({ claimType: "__proto__", slug: 1 }));
    assert.equal(buildAssetUrl("https://assets.example/", "/banners/", "/image.jpg"), "https://assets.example/banners/image.jpg");
});

test("malformed identifiers, deeply nested objects, and BigInts cannot break log serialization", () => {
    const deep = {};
    let child = deep;
    for (let i = 0; i < 200; i += 1) child = child.next = {};
    const result = redactSensitiveData({ imei: Object.create(null), email: {}, token: "secret", deep, count: 2n });
    assert.equal(result.imei, "[REDACTED]");
    assert.equal(result.token, "[REDACTED]");
    assert.doesNotThrow(() => JSON.stringify(result));
    assert.ok(JSON.stringify(result).includes("MAX_DEPTH"));
    assert.equal(redactSensitiveData(864265082387394n, "imei"), "***********7394");
});

test("invoice, JSON, integer, and NZ calendar validation reject invalid values", () => {
    const validators = loadModule("utils/validators.js", {
        "../config/securityFeatureConfig": { isStrictProductionSecurity: () => false },
    });
    for (const value of ["123", "INV-123", "A1B2"]) assert.equal(validators.invoiceNumber().validate(value).valid, true);
    for (const value of ["ABC", "-12", "12-", " 12", "12 ", "A 12", "12--34"]) {
        assert.equal(validators.invoiceNumber().validate(value).valid, false);
    }
    assert.equal(validators.integer().validate("9999999999999999999").valid, false);
    assert.equal(validators.jsonObject().validate('{"devices":"watch"}').valid, true);
    for (const value of ["broken", "[]", "null", '{"__proto__":{"x":1}}']) {
        assert.equal(validators.jsonObject().validate(value).valid, false);
    }
    assert.equal(require("../utils/nzTimeZone").toNewZealandDateTime("2026-02-31"), null);
});

test("HTTP transport parses JSON, rejects non-HTTPS, malformed JSON and failed HTTP responses", async () => {
    const load = (fetch) => loadModule("utils/httpJson.js", {}, { fetch }).requestJson;
    assert.deepEqual(await load(async () => new Response('{"ok":true}'))({ url: "https://example.com" }), { ok: true });
    await assert.rejects(load(() => assert.fail("must not send HTTP"))({ url: "http://example.com" }), /HTTPS/);
    await assert.rejects(load(async () => new Response("not JSON"))({ url: "https://example.com" }), /Invalid JSON/);
    await assert.rejects(load(async () => new Response('{"error":"expired"}', { status: 401 }))({ url: "https://example.com" }),
        (error) => error.statusCode === 401 && error.response.error === "expired");
});

test("HTTP transport bounds the response body and times out stalled requests", async () => {
    const large = loadModule("utils/httpJson.js", {}, { fetch: async () => new Response('"' + "a".repeat(200) + '"') }).requestJson;
    await assert.rejects(large({ url: "https://example.com", maxResponseBytes: 100 }), { code: "UPSTREAM_RESPONSE_TOO_LARGE" });
    const stalled = loadModule("utils/httpJson.js", {}, {
        fetch: (url, options) => new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))),
    }).requestJson;
    const keepAlive = setTimeout(() => {}, 1000);
    try {
        await assert.rejects(stalled({ url: "https://example.com", timeoutMs: 10 }), { code: "UPSTREAM_TIMEOUT" });
    } finally {
        clearTimeout(keepAlive);
    }
});

test("bounded caches expire values and cannot grow beyond their entry limit", () => {
    let now = 0;
    const { ExpiringCache } = loadModule("utils/expiringCache.js", {}, { Date: { now: () => now } });
    const cache = new ExpiringCache({ maxEntries: 2 });
    cache.set("a", 1, 10);
    cache.set("b", 2, 10);
    cache.set("c", 3, 10);
    assert.equal(cache.get("a"), undefined);
    now = 11;
    assert.equal(cache.get("c"), undefined);
    assert.ok(cache.entries.size <= 2);
});

test("development and local production-test reCAPTCHA switches retain their existing behavior", () => {
    for (const [environment, localProductionTest, disabled, enabled, strict] of [
        ["development", false, "1", false, false],
        ["production", true, "1", false, false],
        ["production", false, "0", true, true],
    ]) {
        const service = loadModule("config/securityFeatureConfig.js", {
            "./envConfig": { environment, app: { localProductionTest } },
        }, { process: { env: { RECAPTCHA_DISABLED: disabled } } });
        assert.equal(service.isRecaptchaEnabled(), enabled);
        assert.equal(service.isStrictProductionSecurity(), strict);
    }
});

test("rate-limit keys stay scoped to IP, endpoint, and business identifier without coercing objects", () => {
    const service = loadModule("config/securityConfig.js", {
        "./envConfig": { rateLimit: {}, app: {} },
        "express-rate-limit": { rateLimit: (options) => options, ipKeyGenerator: (value) => value },
        "../services/securityLogService": {}, "../utils/apiResponse": {},
    });
    const key = service.writeRateLimiter.keyGenerator;
    const req = { ip: "127.0.0.1", originalUrl: "/api/claims/status", body: { claim_id: "OPNZPROCLM-261028-TEST1234" } };
    assert.notEqual(key(req), key({ ...req, originalUrl: "/api/claims" }));
    assert.notEqual(key(req), key({ ...req, body: { claim_id: "OPNZPROCLM-261028-OTHER123" } }));
    assert.doesNotThrow(() => key({ ...req, body: { imei: Object.create(null) } }));
});
