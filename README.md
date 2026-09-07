# OPPONZ Promotions API

Node.js/Express API for OPPO NZ promotions, claims, events, devices, gifts, and related promotion workflows.

## Scripts

```bash
npm run dev
npm start
```

- `npm run dev` starts the API in development mode.
- `npm start` starts the API in production mode.

## Environment Files

Environment files are intentionally ignored by Git. When `.env`, `.env.development`, or `.env.production` changes, the matching values must be added manually on the server.

- `.env` contains shared/base settings.
- `.env.development` contains local development settings.
- `.env.production` contains production settings.

## Security

This API includes security middleware and operational safeguards for rate limiting, trusted proxy IP handling, CORS, Helmet security headers, API key protection, reCAPTCHA verification, request/error/security logs, production error email alerts, unified error responses, response field allowlists, sensitive log redaction, route/method security logging, and reusable request validation.

## Rate Limiting

Rate limits are layered so a busy shared store IP is less likely to block unrelated workflows.

- Global fallback: `RATE_LIMIT_WINDOW_MS=900000`, `RATE_LIMIT_MAX=600`.
- Public read APIs: `PUBLIC_RATE_LIMIT_WINDOW_MS=900000`, `PUBLIC_RATE_LIMIT_MAX=500`.
- Write/submit APIs: `WRITE_RATE_LIMIT_WINDOW_MS=3600000`, `WRITE_RATE_LIMIT_MAX=30`.
- IMEI verification APIs: `IMEI_VERIFICATION_RATE_LIMIT_WINDOW_MS=3600000`, `IMEI_VERIFICATION_RATE_LIMIT_MAX=20`.
- reCAPTCHA-protected utility APIs: `RECAPTCHA_RATE_LIMIT_WINDOW_MS=900000`, `RECAPTCHA_RATE_LIMIT_MAX=300`.

The global fallback still uses the client IP as a broad abuse guard. Route-level limiters use more specific keys where possible:

- Public read APIs use `IP + endpoint`, so one endpoint being busy does not consume another endpoint's allowance.
- IMEI verification APIs use `IP + endpoint + IMEI`, so a store can verify different IMEIs from the same public IP without sharing one small counter.
- Claim status checks use `IP + endpoint + claim_id` when the claim reference is present.
- NZ Post address search/detail APIs use `IP + endpoint + q` or `IP + endpoint + dpid`.
- Claim submission endpoints may fall back to `IP + endpoint` before multipart file parsing, which avoids accepting file uploads before rate limiting.

See [docs/security.md](docs/security.md) for the full security configuration and usage notes.
