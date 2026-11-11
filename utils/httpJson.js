const requestJson = async ({ url, method = "GET", headers = {}, body, timeoutMs = 10000,
    maxResponseBytes = 2 * 1024 * 1024, label = "Upstream service" }) => {
    const requestUrl = new URL(url);
    if (requestUrl.protocol !== "https:") throw new Error(`${label} requires HTTPS.`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();

    try {
        const response = await fetch(requestUrl, {
            method, headers: { Accept: "application/json", ...headers }, body,
            signal: controller.signal, redirect: "error",
        });
        const chunks = [];
        let size = 0;

        for await (const chunk of response.body || []) {
            size += chunk.byteLength;
            if (size > maxResponseBytes) {
                controller.abort();
                const error = new Error(`${label} response is too large.`);
                error.code = "UPSTREAM_RESPONSE_TOO_LARGE";
                throw error;
            }
            chunks.push(Buffer.from(chunk));
        }

        const text = Buffer.concat(chunks).toString("utf8");
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (cause) {
            const error = new Error(`Invalid JSON returned by ${label}.`, { cause });
            error.statusCode = response.ok ? 502 : response.status;
            throw error;
        }

        if (!response.ok) {
            const error = new Error(`${label} returned HTTP ${response.status}`);
            error.statusCode = response.status;
            error.response = data;
            throw error;
        }

        return data;
    } catch (error) {
        if (controller.signal.aborted && error.code !== "UPSTREAM_RESPONSE_TOO_LARGE") {
            const timeoutError = new Error(`${label} request timed out.`, { cause: error });
            timeoutError.code = "UPSTREAM_TIMEOUT";
            throw timeoutError;
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
};

module.exports = { requestJson };
