# API Security Guide

This document summarizes the security setup for the OPPONZ Promotions API.

## Environment Loading

The app loads `.env` first, then loads the environment-specific file with override:

- Development: `.env` + `.env.development`
- Production: `.env` + `.env.production`

Environment files are ignored by Git. Any server-side change must be added manually to the deployment environment.

## Production Startup Checks

Production startup runs `config/startupSecurityCheck.js`.

Required production settings:

```env
ENFORCE_HTTPS=true
TRUST_PROXY=1
IP_DEBUG=false
INTERNAL_API_KEYS=your-long-random-api-key
```

Recommended production settings:

```env
CORS_ORIGINS=https://your-frontend-domain.example
TOKEN_SECRET=your-long-random-token-secret
BODY_LIMIT=100kb
ADMIN_EMAIL=admin@example.com
ERROR_ALERT_COOLDOWN_MS=300000
```

`CORS_ORIGINS` should contain frontend website origins, not the API domain. Multiple owned frontend sites can be separated by commas:

```env
CORS_ORIGINS=https://site1.example,https://site2.example
```

## Trusted Proxy And Real IP

`TRUST_PROXY` controls how Express reads the real client IP when the app runs behind a reverse proxy or load balancer.

- Local development: `TRUST_PROXY=false`
- Production behind one trusted proxy: `TRUST_PROXY=1`

`IP_DEBUG=true` enables `/api/health/ip` for local diagnostics. It should be `false` in production.

## Rate Limiting

Rate limits are configured in `config/securityConfig.js` and mounted in `routes/index.js`.

Current limiter groups:

- Default fallback limiter
- Public read limiter
- Write limiter
- reCAPTCHA limiter
- Health limiter

When rate limited, the API returns unified error format with code `RATE_LIMIT_EXCEEDED` and writes a security log entry.

## CORS

CORS is configured in `config/corsConfig.js`.

Development allows localhost and 127.0.0.1 origins by default. Production only allows origins listed in `CORS_ORIGINS`.

Allowed request headers include:

- `Content-Type`
- `Authorization`
- `X-API-Key`
- `X-Request-Id`
- `X-Recaptcha-Token`

Blocked origins are written to the security log.

## Security Headers

Helmet is configured in `config/helmetConfig.js`.

The API disables `X-Powered-By` and uses security headers for:

- Content Security Policy
- Frame protection
- Referrer policy
- MIME sniffing protection
- Cross-origin policies
- Production HSTS

## API Key Protection

Internal/admin routes can use:

```js
const { requireApiKey } = require("../middlewares/apiKeyAuth");
```

Clients must send:

```http
X-API-Key: your-key
```

Configure keys with:

```env
INTERNAL_API_KEYS=your-long-random-api-key
```

Multiple keys can be comma-separated later if needed.

## reCAPTCHA

reCAPTCHA verification is handled by:

- `services/recaptchaService.js`
- `middlewares/recaptchaMiddleware.js`
- `controllers/recaptchaController.js`

Configure:

```env
RECAPTCHA_SECRET_KEY=your-secret-key
RECAPTCHA_MIN_SCORE=0.3
```

Reusable middleware example:

```js
const { requireRecaptcha } = require("../middlewares/recaptchaMiddleware");

router.post("/claim", requireRecaptcha({ action: "claim" }), createClaim);
```

## Unified API Response Format

Responses should use `utils/apiResponse.js`.

Success:

```json
{
  "success": true,
  "data": {},
  "requestId": "..."
}
```

Error:

```json
{
  "success": false,
  "message": "Bad Request",
  "requestId": "...",
  "code": "VALIDATION_ERROR"
}
```

Production `500` errors do not expose SQL messages, stack traces, or file paths to clients. Full details stay in logs and production alert emails.

## Error Handling And Email Alerts

Error handling is centralized in `middlewares/errorHandler.js`.

Production error alerts are sent by `services/errorAlertService.js` when:

- `NODE_ENV=production`
- status is `500` or above
- SMTP settings and `ADMIN_EMAIL` are configured
- the alert fingerprint is outside the cooldown window

Configure:

```env
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
ADMIN_EMAIL=
ERROR_ALERT_COOLDOWN_MS=300000
```

## Logging

Logs are written by `services/logService.js`.

Current log folders:

- `logs/requests/req-YYYY-MM-DD.log`
- `logs/errors/err-YYYY-MM-DD.log`
- `logs/security/sec-YYYY-MM-DD.log`

Default retention is 21 days.

Optional settings:

```env
LOG_DIR=logs
LOG_RETENTION_DAYS=21
LOG_CLEANUP_INTERVAL_MS=3600000
```

## Sensitive Log Redaction

Sensitive data is redacted by `utils/redactSensitiveData.js` before writing logs or sending alert emails.

Fully redacted examples:

- `password`
- `token`
- `secret`
- `apiKey`
- `authorization`
- `cookie`
- `recaptchaToken`

Partially preserved for troubleshooting:

- `email`: keeps first letter and domain
- `contact`: keeps last 4 digits
- `imei`: keeps last 4 digits
- `receipt_url` / `screenshot_url`: keeps file name only
- `street` / full address: redacted
- IDs such as `claim_id`, `customer_id`, `promotion_id`: preserved

The goal is to keep enough information to find the database record without exposing complete private data or secrets.

## Field Allowlists

API response fields are listed in `config/apiFields.js`.

Rules:

- Do not return full Sequelize model objects directly.
- Use explicit `attributes` in external API queries.
- `updated_at` fields are excluded by default.
- Sensitive fields should be removed from the allowlist before exposing an API publicly.

Example:

```js
const apiFields = require("../config/apiFields");

Promotions.findAll({
  attributes: apiFields.Promotions,
});
```

## Request Validation

Reusable validation middleware is in:

- `middlewares/validateRequest.js`
- `utils/validators.js`

Current validators include:

- `required()`
- `optional()`
- `email()`
- `imei()`
- `contact()`
- `postcode()`
- `maoriEnglishName()`
- `street()`
- `stringLength()`
- `integer()`
- `oneOf()`
- `date()`
- `url()`

Validation middleware defaults to strict mode. Unknown fields return `400 VALIDATION_ERROR`.

Example:

```js
const { validateRequest } = require("../middlewares/validateRequest");
const { required, email, imei } = require("../utils/validators");

router.post(
  "/claim",
  validateRequest({
    body: {
      email: [required(), email()],
      imei: [required(), imei()],
    },
  }),
  createClaim
);
```

Current specific rules:

- IMEI must be a 15-digit number starting with `86`.
- Email must contain `@` and at least one `.` after `@`.
- Contact must contain digits only.
- Postcode must be exactly 4 digits and should stay as a string.
- Name fields are normalized to title case.
- Street fields are normalized to title case, and letters immediately after a street number are uppercased, for example `87a albert street` becomes `87A Albert Street`.

## Route And Method Security

`middlewares/routeSecurity.js` handles route security behavior.

- Known route with wrong HTTP method returns `405 METHOD_NOT_ALLOWED`.
- Unknown route returns `404 ROUTE_NOT_FOUND`.
- Both are written to security logs.

Existing routes use this pattern:

```js
router.route("/current")
  .get(getCurrentPromotions)
  .all(methodNotAllowed(["GET"]));
```

## Server Timeouts

Server timeout settings are applied in `index.js`.

Recommended settings:

```env
SERVER_REQUEST_TIMEOUT_MS=30000
SERVER_HEADERS_TIMEOUT_MS=10000
SERVER_KEEP_ALIVE_TIMEOUT_MS=5000
```

## HTTPS Enforcement

Production should set:

```env
ENFORCE_HTTPS=true
```

HTTP requests return `426 HTTPS_REQUIRED` when HTTPS enforcement is enabled and the request is not secure.

## Manual Production Reminder

Before production deployment, verify:

- Production database account uses least privilege.
- `.env.production` values are present on the server.
- `TRUST_PROXY` matches the real proxy setup.
- `CORS_ORIGINS` contains only owned frontend origins.
- `IP_DEBUG=false`.
- `ENFORCE_HTTPS=true`.
- `INTERNAL_API_KEYS` is configured.
- SMTP and `ADMIN_EMAIL` are configured if production email alerts are expected.
