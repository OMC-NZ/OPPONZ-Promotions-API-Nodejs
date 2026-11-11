const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const express = require("express");
const { loadModule } = require("./helpers/loadModule");
const { validateClaimFile } = require("../utils/claimFilePolicy");

test("real multipart uploads support one or multiple gift aliases and enforce upload limits", async (t) => {
    const { createClaimUpload } = loadModule("middlewares/claimUpload.js", {
        "../config/envConfig": { r2: { uploadMaxBytes: 1024 } },
    });
    const { giftAliases } = loadModule("utils/validators.js", {
        "../config/securityFeatureConfig": { isStrictProductionSecurity: () => false },
    });
    const app = express();
    app.post("/claims", createClaimUpload({ maxFiles: 2, fields: [
        { name: "receipt", maxCount: 1 }, { name: "screenshot", maxCount: 1 },
    ] }), (req, res, next) => {
        try {
            const result = giftAliases().validate(req.body.gift_alias);
            if (!result.valid) return res.status(400).json({ code: "INVALID_GIFTS" });
            for (const file of Object.values(req.files || {}).flat()) validateClaimFile(file, 1024);
            return res.json({ aliases: result.value, files: Object.keys(req.files || {}) });
        } catch (error) { next(error); }
    });
    app.use((error, req, res, next) => res.status(error.statusCode || 400).json({ code: error.code || "INVALID_FILE" }));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
    const url = `http://127.0.0.1:${server.address().port}/claims`;
    const submit = async (aliases, { field = "receipt", size = 4 } = {}) => {
        const form = new FormData();
        form.append("gift_alias", JSON.stringify(aliases));
        const bytes = Buffer.alloc(size, 1);
        bytes.set([0xff, 0xd8, 0xff]);
        form.append(field, new Blob([bytes], { type: "image/jpeg" }), "receipt.jpg");
        return fetch(url, { method: "POST", body: form });
    };
    for (const aliases of [["earbuds-white"], ["earbuds-white", "watch-black"]]) {
        const response = await submit(aliases);
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).aliases, aliases);
    }
    assert.equal((await submit([])).status, 400);
    const unexpected = await submit(["earbuds-white"], { field: "wrong_field" });
    assert.equal((await unexpected.json()).code, "LIMIT_UNEXPECTED_FILE");
    const oversized = await submit(["earbuds-white"], { size: 1025 });
    assert.equal((await oversized.json()).code, "LIMIT_FILE_SIZE");
});

test("installed Nodemailer renders confirmation mail without using SMTP or external services", async () => {
    const transporter = require("nodemailer").createTransport({ streamTransport: true, buffer: true });
    const result = await transporter.sendMail({
        from: "test@example.com", to: "customer@example.com", subject: "Claim confirmation",
        text: "Selected gifts: Earbuds White, Watch Black",
        html: "<p>Selected gifts: Earbuds White, Watch Black</p>",
    });
    assert.match(result.message.toString(), /Claim confirmation/);
    assert.match(result.message.toString(), /Earbuds White, Watch Black/);
});
