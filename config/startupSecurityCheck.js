const config = require("./envConfig");

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

const formatIssue = (issue) => `- ${issue.key}: ${issue.message}`;

const parseByteSize = (value) => {
  const match = String(value || "").trim().toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb)?$/);
  if (!match) return undefined;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2] || "b";
  const multipliers = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
  };

  return amount * multipliers[unit];
};

const checkProductionSecurityConfig = () => {
  const required = [];
  const warnings = [];

  if (config.environment !== "production") {
    console.log("Startup security check skipped outside production.");
    return;
  }

  if (!config.app.enforceHttps) {
    required.push({
      key: "ENFORCE_HTTPS",
      message: "set ENFORCE_HTTPS=true in production.",
    });
  }

  if (config.app.trustProxy === false) {
    required.push({
      key: "TRUST_PROXY",
      message: "set TRUST_PROXY to the number of trusted proxies, usually TRUST_PROXY=1 behind one reverse proxy.",
    });
  }

  if (config.app.ipDebug) {
    required.push({
      key: "IP_DEBUG",
      message: "set IP_DEBUG=false in production so client IP diagnostics are not exposed.",
    });
  }

  if (config.common.internalApiKeys.length === 0) {
    required.push({
      key: "INTERNAL_API_KEYS",
      message: "add at least one long random API key for protected internal/admin endpoints.",
    });
  }

  if (config.app.corsOrigins.length === 0) {
    warnings.push({
      key: "CORS_ORIGINS",
      message: "add your production frontend origin, for example CORS_ORIGINS=https://your-site.example.",
    });
  }

  if (config.app.corsOrigins.some((origin) => origin.includes("localhost") || origin.includes("127.0.0.1"))) {
    warnings.push({
      key: "CORS_ORIGINS",
      message: "remove localhost origins from production CORS_ORIGINS.",
    });
  }

  const bodyLimitBytes = parseByteSize(config.app.bodyLimit);
  if (bodyLimitBytes === undefined) {
    warnings.push({
      key: "BODY_LIMIT",
      message: "BODY_LIMIT should use a clear size such as 100kb or 1mb.",
    });
  } else if (bodyLimitBytes > 1024 * 1024) {
    warnings.push({
      key: "BODY_LIMIT",
      message: "BODY_LIMIT is larger than 1mb; keep it small unless a specific endpoint needs uploads.",
    });
  }

  if (isBlank(config.common.tokenSecret)) {
    warnings.push({
      key: "TOKEN_SECRET",
      message: "set a long random token secret before adding token-based authentication.",
    });
  }

  if (isBlank(config.email.adminEmail)) {
    warnings.push({
      key: "ADMIN_EMAIL",
      message: "production error alert emails will not be sent without ADMIN_EMAIL.",
    });
  }

  if (isBlank(config.email.host) || isBlank(config.email.user) || isBlank(config.email.pass)) {
    warnings.push({
      key: "EMAIL_HOST/EMAIL_USER/EMAIL_PASS",
      message: "production error alert emails need SMTP settings.",
    });
  }

  if (isBlank(config.recaptcha.secretKey)) {
    warnings.push({
      key: "RECAPTCHA_SECRET_KEY",
      message: "forms using reCAPTCHA will fail until this is configured.",
    });
  }

  if (required.length > 0) {
    const message = [
      "Production security configuration is incomplete.",
      "",
      "Required fixes:",
      ...required.map(formatIssue),
      warnings.length > 0 ? "" : undefined,
      warnings.length > 0 ? "Recommended fixes:" : undefined,
      ...warnings.map(formatIssue),
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(message);
  }

  if (warnings.length > 0) {
    console.warn([
      "Production security configuration warnings:",
      ...warnings.map(formatIssue),
    ].join("\n"));
    return;
  }

  console.log("Production security configuration check passed.");
};

module.exports = {
  checkProductionSecurityConfig,
};
