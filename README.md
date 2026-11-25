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
- `npm run dev:prod-env` starts the API locally with `NODE_ENV=production`, loads `.env.test.prod`, and sets `LOCAL_PRODUCTION_TEST=true`. It uses the same DB/DDB routing as development: active reads/writes use development DDB, while explicitly DB-bound queries use `.env.test.prod` DB settings. Other production-test settings are unchanged.
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

`POST /api/promotions/verify-imei-purchase` reads only `Devices` through the active environment connection: DDB in `npm run dev` and `dev:prod-env` (currently `OMC_Promotions_Dev`), and DB in real production. The remaining six tables (`Promotion_Devices`, `Promotion_Channels`, `Promotions`, `Promotion_Gifts`, `Channels`, and `Gifts`) continue to use DB. Device model, channel, and redemption status come from the selected device record; a missing or redeemed DDB device does not fall back to DB. This endpoint does not write data.

In development and `dev:prod-env`, the separate DB connection pool for DB-bound reads is initialized on demand; in real production, the existing DB pool is reused.

`POST /api/claims` reads promotion configuration and gifts from DB: `Promotions`, `Promotion_Devices`, `Promotion_Channels`, `Promotion_Gifts`, and `Gifts`. In development and `dev:prod-env`, only device availability is read from DDB during eligibility checking; the submission does not query DDB `Gifts`. Selected gift IDs come directly from DB. Customers, claims, delivery addresses, claim-gift links, and device updates remain in one DDB transaction. Confirmation emails read the saved claim, customer, address, and gift links from DDB, fetch gift details separately from DB, and update email status in DDB. Real production continues to read and write only DB.

DDB must still contain the referenced promotion ID and gift records with the same IDs and meanings as DB for local test submissions. In particular, DDB `Claim_Gifts.gift_id` now stores the DB gift ID, so an unrelated DDB gift with that ID is not a valid replacement. Its foreign keys remain enabled: reading an activity or gift from DB does not create the corresponding parent row in DDB or bypass referential integrity. The API does not automatically copy production records into DDB.

Other endpoints use the active database: DDB in development and `dev:prod-env`, and DB in real production. This includes event IMEI/channel verification, event forms, event submissions, and claim tracking.

When running `npm run dev`, these DB-bound reads use only the `DB_*` database settings from `.env.production`, parsed in isolation. Development ports, reCAPTCHA switches, CORS, upload providers, and `DDB_*` settings continue to come from the normal development environment. No production settings are copied into `process.env` or written to an environment file. Keep `.env.production` available locally with the intended DB credentials.

`dev:prod-env` reads only DDB settings from `.env.development`, parsed in isolation, and uses the DB settings from `.env.test.prod`. It does not import development ports, security switches, or upload settings. This split mode requires both `.env.test.prod` and `LOCAL_PRODUCTION_TEST=true`; the flag alone does not switch a normal `.env.production` startup to DDB. Missing DDB settings fail explicitly, without falling back to production DB for writes. Missing DB settings likewise do not fall back to DDB for DB-bound queries.

Real production startup continues to use `.env.production` normally, with all database reads and writes on DB. Environment files are not rewritten by this routing logic.

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

### Promotion Gift Metadata

`Promotion_Gifts.gift_comb` is an integer on the promotion-gift relationship, not a field on `Gifts`. Both endpoints that query `Promotion_Gifts` return it with the associated gift:

- `POST /api/promotions/verify-imei-purchase`: `data.promotions[].gifts[].gift_comb`.
- `POST /api/claims`: `data.gifts[].gift_comb`, alongside the existing `data.claim_id` and `data.gift` fields.

Each structured gift contains `name`, `alias`, `color`, `status`, and `gift_comb`. Values are returned as stored, including zero. The same gift can have different values in different promotions; distinct relationship rows are preserved. This field does not add combination-selection validation or change database routing, claim persistence, or gift-status filtering. `GET /api/promotions/current` does not query this table and keeps its existing response unchanged.

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
