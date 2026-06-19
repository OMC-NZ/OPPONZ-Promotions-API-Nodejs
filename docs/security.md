# API Security Overview

This document provides a high-level security overview for the OPPONZ Promotions API. It is safe to keep in the repository because it avoids real secrets, infrastructure details, and production-specific values.

## Security Scope

The API includes layered controls for public consumer-facing endpoints and future internal/admin endpoints. Security is handled through middleware, environment-based configuration, logging, validation, and safer response patterns.

## Environment Configuration

The app uses environment files for local and production settings. These files are ignored by Git and must be configured directly in the deployment environment.

Do not commit:

- Database credentials
- API keys
- Token secrets
- SMTP credentials
- Production hostnames or infrastructure details

## Request Protection

The API includes controls for:

- Request rate limiting
- Trusted proxy IP handling
- HTTPS enforcement
- CORS origin restrictions
- Security response headers
- Request body size limits
- API key protection for internal-style endpoints
- reCAPTCHA support for public form submissions

The exact production values should be managed outside source control.

## Public And Internal API Classification

In this project:

- Public APIs are called by public-facing systems, such as consumer promotion pages or claim forms.
- Internal APIs are called by internal systems, such as admin dashboards, approval tools, reporting tools, or internal automation.

Public APIs should use controls such as rate limiting, reCAPTCHA where appropriate, strict validation, duplicate checks, and limited response fields.

Internal APIs should additionally use stronger authentication and authorization when they expose sensitive data or modify business records.

## Response Safety

API responses should use the shared response helpers so that success and error formats remain consistent.

Production error responses must not expose:

- SQL errors
- Stack traces
- Server paths
- Internal implementation details
- Secrets or tokens

Full diagnostic details should stay in server-side logs and controlled alert channels.

## Logging And Alerts

The API separates operational logs, error logs, and security-related logs. Logs are rotated and retained for a limited period.

Production error alerts can be sent to an administrator when configured. Alerts are rate-limited to avoid notification floods.

Logs and alerts should support troubleshooting without exposing raw private data or secrets.

## Sensitive Data Redaction

Sensitive log data is redacted before it is written or sent in alerts.

The redaction strategy is:

- Fully hide secrets, tokens, keys, cookies, and authorization values.
- Partially mask personal identifiers where possible.
- Preserve non-sensitive database IDs when they help locate records.
- Keep enough information for debugging without exposing full private data.

## Field Allowlists

External API queries should use explicit field allowlists instead of returning full Sequelize model objects.

Rules:

- Query only the fields needed by the endpoint.
- Do not expose internal timestamps or operational fields unless required.
- Review sensitive fields before exposing any new endpoint.
- Keep allowlists updated when models change.

## Request Validation

Request validation is centralized through reusable validators and validation middleware.

Validation should be applied to:

- Request bodies
- Query strings
- Route params

Current validation support includes common checks for required values, emails, IMEI values, contact numbers, postcodes, strings, integers, dates, URLs, and allowed values. Some user-facing text fields may be normalized instead of rejected when safe to do so.

New APIs should define their accepted fields explicitly. Unknown fields should remain rejected unless a specific endpoint needs a flexible payload.

## Route And Method Handling

Known routes should reject unsupported HTTP methods with a controlled response.

Unknown routes should return a controlled not-found response and be logged as security-relevant activity.

## Operational Checklist

Before production deployment, confirm that:

- Environment variables are configured outside Git.
- Production secrets are not present in committed files.
- The database user follows least-privilege principles.
- Public endpoints do not expose unnecessary fields.
- Form submission endpoints use validation and anti-abuse controls.
- Internal/admin endpoints use appropriate authentication and authorization.
- Logs and alerts do not expose raw sensitive data.

## Maintenance Notes

When adding a new endpoint:

1. Classify it as public or internal.
2. Choose the correct rate limiter.
3. Add request validation.
4. Use response helpers.
5. Use field allowlists for database queries.
6. Add reCAPTCHA or API key protection where appropriate.
7. Ensure errors flow through the central error handler.
8. Avoid logging raw request bodies or unredacted sensitive data.
