# OPPONZ Promotions API

Node.js/Express API for OPPO NZ promotions, claims, events, devices, gifts, and related promotion workflows.

Requires Node.js 20 or newer. Install the locked dependencies with `npm ci` (or `npm ci --omit=dev` on the production server).

## Scripts

```bash
npm run dev
npm run dev:prod-env
npm start
```

- `npm run dev` starts the API in development mode.
- `npm run dev:prod-env` starts the API locally with `NODE_ENV=production`, loads `.env.test.prod`, and sets `LOCAL_PRODUCTION_TEST=true`. Use this for local production-environment testing without using the real `.env.production` file.
- `npm start` starts the API in production mode.

## Environment Files

Environment files are intentionally ignored by Git. When `.env`, `.env.development`, or `.env.production` changes, the matching values must be added manually on the server.

- `.env` contains shared/base settings.
- `.env.development` contains local development settings.
- `.env.test.prod` contains local production-environment test settings used by `npm run dev:prod-env`.
- `.env.production` contains production settings.

## Database Routing

The following endpoints always read the database configured by `DB_*`, including when running `npm run dev`:

- `GET /api/promotions/current`
- `GET /api/events/current`
- `POST /api/promotions/verify-imei-purchase`

All device, model eligibility, promotion, gift and channel queries inside promotion IMEI verification use that same DB connection. In development, a separate DB connection pool is initialized only when one of these endpoints is called; in production, the existing DB pool is reused.

`POST /api/claims` also reads promotion configuration from DB: `Promotions`, `Promotion_Devices`, `Promotion_Channels`, `Promotion_Gifts`, and the gift catalog used to validate promotion links. In development, device availability and destination gift IDs are read from DDB. Customers, claims, delivery addresses, claim-gift links, and device updates remain in one DDB transaction; confirmation email status also stays in DDB. Production and `dev:prod-env` continue to read and write DB as before. Gift aliases are matched between catalogs; DB gift IDs are never inserted into DDB claim-gift links.

DDB must still contain the referenced promotion ID and gift records for local test submissions. Its foreign keys remain enabled: reading an activity from DB does not create the corresponding parent row in DDB or bypass referential integrity. The API does not automatically copy production records into DDB.

Other endpoints keep their existing routing: development uses `DDB_*`, while production and `dev:prod-env` use `DB_*`. This includes event IMEI/channel verification, event forms, and claim tracking.

When running `npm run dev`, these DB-bound reads use only the `DB_*` database settings from `.env.production`, parsed in isolation. Development ports, reCAPTCHA switches, CORS, upload providers, and `DDB_*` settings continue to come from the normal development environment. No production settings are copied into `process.env` or written to an environment file. Keep `.env.production` available locally with the intended DB credentials.

Production startup continues to use `.env.production` normally. `dev:prod-env` continues to use the `DB_*` settings in `.env.test.prod`. These endpoints do not fall back to `DDB_*` if DB settings or the DB connection are unavailable.

## Claim Gifts

`POST /api/claims` requires `gift_alias` to be a non-empty array of unique gift aliases:

```json
{ "gift_alias": ["earbuds-white", "watch-black"] }
```

For multipart submissions with files, send the array as JSON text:

```javascript
formData.append("gift_alias", JSON.stringify(["earbuds-white", "watch-black"]));
```

Each alias must be a string of up to 45 characters and match a gift linked to the submitted promotion. A single alias string is not accepted. All selected gifts are saved to `Claim_Gifts` in the claim transaction and included in the confirmation email. The submission response keeps `data.gift` as a string containing all selected gift names, separated by commas.

## Security

This API includes security middleware and operational safeguards for rate limiting, trusted proxy IP handling, CORS, Helmet security headers, API key protection, reCAPTCHA verification, request/error/security logs, production error email alerts, unified error responses, response field allowlists, sensitive log redaction, route/method security logging, and reusable request validation.

## Verification And Maintenance

Run `npm test` for the automated regression suite. Tests use isolated database/storage/SMTP substitutes and a temporary loopback HTTP server for real multipart uploads; they do not submit claims to a configured database or send customer emails.

See [docs/performance-review.md](docs/performance-review.md) for the performance/security review, shared helpers, deployment checks, and remaining infrastructure work.

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
