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

See [docs/security.md](docs/security.md) for the full security configuration and usage notes.
