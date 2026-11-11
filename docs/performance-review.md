# Performance And Security Review

Review date: 28 October 2026.

The review covered the startup flow, configuration, API routes, controllers, middleware, database models and associations, external services, uploads, email, and logging. Production database contents and server configuration were not accessed or changed. These are source-level improvements and regression checks, not a production load-test result or a guarantee that no vulnerabilities remain.

## Implemented Changes

### Shared Functions

- `utils/httpJson.js` replaces separate HTTP/JSON implementations for Google reCAPTCHA, NZ Post, OneDrive, and event email templates. It uses the built-in fetch connection pool, an overall timeout covering response-body reading, response-size limits, HTTPS, and controlled errors. Redirects are rejected to avoid forwarding authenticated requests to a different destination. URLs should therefore point directly to the final service endpoint.
- `services/mailService.js` provides one reusable SMTP pool per process for confirmation emails and alerts, with up to three connections, TLS, and connection/socket timeouts. Port 465 uses implicit TLS; other SMTP ports require STARTTLS. Local-file and remote-URL attachment access is disabled.
- `utils/claimFilePolicy.js` owns permitted file types, filename extensions, UUID filenames, folder validation, and file-content checks for both storage providers.
- `middlewares/claimUpload.js` configures multipart parsing and upload errors for both claim routes. Receipt and screenshot field names remain unchanged. Parsing limits include 40 text fields, 16 KiB per text field, and the existing two promotion files or ten event files.
- `utils/claimId.js` generates both promotion and event claim references. Prefixes, dates, and eight-character suffixes keep their existing format; random suffix characters now use unbiased cryptographic selection.
- `utils/text.js` centralizes scalar conversion, normalization, gift display names, text joining, and HTML escaping. Objects are not coerced into valid strings.
- `utils/assetUrl.js` shares banner/terms URL construction and removes extra separators at path boundaries. Missing asset filenames produce `null`.
- `utils/expiringCache.js` provides expiry and entry bounds for reusable caches and cooldowns.

### Database And Concurrency

- Promotion IMEI verification reuses the eligible channel rows already queried by the eligibility service. The second query of the same channel/date eligibility conditions is removed.
- Event IMEI/channel/model checks use `services/eventEligibilityService.js`. Channel/model restrictions use two queries instead of four and share the same implementation between verification and submission. Existing event-wide IMEI reuse rules are preserved.
- Claim submissions validate and upload before opening the write transaction, so external upload delays do not occupy a database connection. Before creating a promotion claim, the device row is locked and its redemption status/model/channel are checked again. Event claims requiring an IMEI acquire the same device-row lock before repeating the duplicate/eligibility check.
- Transaction acquisition is inside the error-handling block. Rollbacks run only for active transactions, and a rollback failure is logged without replacing the original failure.
- Event submissions with `requires_delivery=1` now save their validated address to `Deliver_Addresses.event_claim_id` in the claim transaction. Previously those fields were validated but not saved.
- Scratch-code assignment locks the event claim and available scratch-code rows in a transaction. Resending a confirmation reuses the existing code. SMTP delivery happens after releasing these database locks.
- Database initialization returns an existing instance rather than creating an extra connection pool if called twice.

### External Calls And Caches

- Concurrent OneDrive OAuth requests share one in-flight refresh. Returned refresh-token rotations are retained in memory for the running process; environment files are not rewritten.
- OneDrive folder checks are shared during concurrent uploads and cached for five minutes, with a maximum of 256 folders. Both storage providers use the same object-key builder. Promotion uploads still use `claims/promotions/<promotion id>/<uuid>.<ext>` and the Claims table still stores only the filename.
- NZ Post keeps its existing token cache. A delayed rejection for an older token now reuses an already-refreshed token rather than starting another OAuth request.
- Event email templates are fetched once during concurrent requests and cached for 60 seconds, with a maximum of 100 templates. Only raw templates are cached, so names and scratch codes cannot leak between recipients. Template edits can take up to 60 seconds to appear.
- Google/NZ Post/template requests have a ten-second overall timeout. OneDrive and R2 file-upload requests have a twenty-second timeout. Invalid, oversized, or stalled upstream responses fail instead of waiting indefinitely.

### Input, Upload, And Logging Safety

- File extensions and MIME types must agree. JPEG, PNG, and PDF file signatures are checked against buffered contents, along with actual buffer size. JPEG/JPG, PNG, and PDF remain the permitted formats; HEIC/HEIF are not accepted. Signature checking is not a full image decoder, PDF sanitizer, or malware scan.
- Integer validation rejects values outside JavaScript's safe integer range. Invoice numbers reject surrounding whitespace as well as internal spaces. Invalid calendar-only purchase dates are rejected.
- Database lookups continue to use Sequelize `where` conditions. The existing date comparisons use fixed column names and `sequelize.escape` for New Zealand wall-clock strings; no request-controlled SQL identifiers or raw SQL concatenation were introduced, and the previously corrected date/time comparison behavior is retained.
- Event `extra_data` must be a JSON object string, with controlled nesting and no prototype-related keys. Required event-specific fields still come from the configured form definitions.
- Log directories are initialized once instead of issuing `mkdir` for every entry. Concurrent appends to a given file are serialized, and graceful shutdown flushes pending entries.
- Console request paths now receive the same query redaction as file logs. Deeply nested data, non-convertible identifiers, buffers, and BigInts cannot trigger the earlier logging conversion/serialization errors. Request IDs have a bounded character set and length.
- Request context and logging run before CORS/HTTPS rejection, giving rejected requests a request ID and response log. Responses that already sent headers are passed to Express's error handler instead of attempting another JSON response.
- Port-binding failures enter the startup error handler. Shutdown ignores repeated signals and has a ten-second deadline.

### Dependency Security

The initial npm production audit reported nine affected dependency entries, including a critical proxy-address advisory. Compatible updates and explicit Express 4/Nodemailer security updates were installed. The resulting installation audit reported zero known vulnerabilities. The lockfile is part of this change and must be deployed with the source.

Notable installed versions: Express 4.22.3, Multer 2.5.0, MariaDB connector 3.5.4, mysql2 3.24.6, and Nodemailer 10.2.1. Nodemailer now requires Node.js 20 or newer. Do not deploy these changes on an older Node.js runtime.

Primary advisory references: [Multer multipart denial of service](https://github.com/expressjs/multer/security/advisories/GHSA-wc9g-mqfw-jrwm), [proxy-addr trust-subnet issue](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h), and [Nodemailer releases](https://github.com/nodemailer/nodemailer/releases).

## Verification

Run:

```bash
npm ci
npm test
npm audit --omit=dev
```

The regression suite covers single/multiple gift submission, eligibility failures, rollback, transaction-acquisition failures, concurrent redemption rechecks, actual multipart parsing/limits, file signatures, HTTP failures/timeouts/body limits, cache bounds, token refresh sharing, email rendering, scratch-code locks, event address persistence, and concurrent log writes. Database locks are checked through isolated query substitutes; they still require a staging concurrency test against the deployed database engine.

No production SMTP message, real R2/OneDrive upload, or live claim insertion was performed during verification. No latency improvement percentage is claimed without a representative load test.

## Deployment And Database Work

1. Confirm `node --version` is at least 20 and use a maintained runtime for production. Deploy `package.json` and `package-lock.json`, then run `npm ci --omit=dev` before restarting PM2. Verify one real promotion submission and one event submission, including storage and email, in an appropriate test environment.
2. Keep the existing production reCAPTCHA/HTTPS checks enabled. The local development/test environment switches and rate-limit allowances have not been relaxed by this review. Ensure `LOCAL_PRODUCTION_TEST` is not enabled on the real server.
3. Confirm MySQL/MariaDB tables use InnoDB so transactions and row locks are effective. Inspect existing indexes with `SHOW INDEX FROM <table>` and query plans with `EXPLAIN` before adding any indexes. The application does not run schema synchronization or automatic index migrations.
4. Candidate indexes to verify against actual data and existing keys include `Promotion_Devices(eligible_model, promotion_id)`, `Promotion_Channels(channel_code, promotion_id, start_date)`, `Gifts(alias)`, `Promotion_Gifts(promotion_id, gift_id)`, `Claim_Gifts(claim_id, gift_id)`, `Event_Claims(imei)`, `Event_Channels(event_id, channel_code)`, `Event_Models(event_id, eligible_model)`, `Deliver_Addresses(claim_id, is_current)`, `Deliver_Addresses(event_claim_id, is_current)`, and `TD_Scratch_Codes(used, event_claim_id, id)`. Current-promotion date scans and form-section/option queries also need plan inspection. Do not add duplicate indexes or unique constraints without checking existing data and business rules.
5. Restrict the Node port to the reverse proxy/private network. Set trusted proxies according to the real proxy chain and strip untrusted forwarding headers at the edge. Keep the confirmed Nginx upload limit aligned with application limits; ten 5 MiB event files exceed a 25 MiB total request limit even though each file is individually allowed.
6. Set memory limits/monitoring with headroom for concurrent in-memory uploads. The multipart limits are per request and do not by themselves bound aggregate upload memory across many clients.

## Remaining Architectural Limits

- Rate-limit counters, tokens, folder/template caches, and cooldowns remain per process. Restarting clears them. Multiple PM2 workers/servers need a shared rate-limit store such as Redis and a pool-size budget per process; do not enable extra workers assuming counters are already shared.
- Confirmation emails are queued in process after commit. A process crash can lose queued work; SMTP acceptance also does not prove inbox delivery. A durable transactional outbox/retry worker and bounce handling require additional storage and operational setup. Promotion `email_status` alone does not provide that guarantee; events do not currently have the same delivery-state field.
- Database rollback cannot roll back cloud storage. An upload followed by a failed database write can leave orphaned objects; scheduled reconciliation or compensating deletion is still needed. Do not automatically delete existing customer evidence based solely on filenames.
- Promotion filename-only submissions are still accepted by the existing API contract. Enforcing actual receipt/screenshot bytes for every submission would change that contract and should be coordinated with the frontend/test clients.
- Dynamic event custom fields currently enforce required presence, but not every possible `validation_json` constraint or option whitelist. A dedicated form-validation contract is still needed before enabling arbitrary custom field types.
- Existing database records, current indexes, engine versions, deployment firewall rules, SMTP deliverability, bucket access policies, and production latency were not independently verified.
