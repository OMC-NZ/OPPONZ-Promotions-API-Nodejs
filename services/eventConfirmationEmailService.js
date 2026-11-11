const { getTransporter, isEmailConfigured } = require("./mailService");
const { normalizeText } = require("../utils/text");
const { requestJson } = require("../utils/httpJson");
const { ExpiringCache } = require("../utils/expiringCache");
const { Op } = require("sequelize");
const config = require("../config/envConfig");
const { models, sequelize } = require("../models");
const { writeLog } = require("./logService");

const templateCache = new ExpiringCache({ maxEntries: 100 });
const pendingTemplates = new Map();

const buildEventTemplateUrl = (slugUrl) => {
    const baseUrl = String(config.r2.publicBaseUrl || "").replace(/\/+$/, "");
    return `${baseUrl}/email_temp/events/${encodeURIComponent(slugUrl)}.json`;
};

const escapeRegExp = (value) => {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const replaceTemplateVariables = (value, variables) => {
    let output = String(value);

    Object.entries(variables).forEach(([key, replacement]) => {
        const safeReplacement = String(replacement ?? "");
        [
            `{{${key}}}`,
            `{{ ${key} }}`,
        ].forEach((placeholder) => {
            output = output.replace(new RegExp(escapeRegExp(placeholder), "g"), () => safeReplacement);
        });
    });

    return output;
};

const renderTemplateValue = (value, variables) => {
    if (typeof value === "string") {
        return replaceTemplateVariables(value, variables);
    }

    if (Array.isArray(value)) {
        return value.map((item) => renderTemplateValue(item, variables));
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, renderTemplateValue(item, variables)])
        );
    }

    return value;
};

const templateUsesVariable = (value, variableNames) => {
    if (typeof value === "string") {
        return variableNames.some((key) => [
            `{{${key}}}`,
            `{{ ${key} }}`,
        ].some((placeholder) => value.includes(placeholder)));
    }

    if (Array.isArray(value)) {
        return value.some((item) => templateUsesVariable(item, variableNames));
    }

    if (value && typeof value === "object") {
        return Object.values(value).some((item) => templateUsesVariable(item, variableNames));
    }

    return false;
};

const getEventTemplateSubject = (template) => {
    if (typeof template.subject !== "string" || !template.subject.trim()) {
        throw new Error("Event confirmation email template subject is required.");
    }

    return template.subject.trim();
};

const getEventTemplateBody = (template) => {
    if (!Array.isArray(template.body)) {
        throw new Error("Event confirmation email template body must be an array.");
    }

    return template.body
        .map((line) => String(line ?? ""))
        .join("\n");
};

const fetchEventEmailTemplate = async (slugUrl) => {
    if (!config.r2.publicBaseUrl) {
        throw new Error("R2 public assets URL is not configured.");
    }

    const templateUrl = buildEventTemplateUrl(slugUrl);
    const cached = templateCache.get(templateUrl);
    if (cached) return cached;
    if (!pendingTemplates.has(templateUrl)) {
        pendingTemplates.set(templateUrl, requestJson({
            url: templateUrl, label: "Event email template", maxResponseBytes: 256 * 1024,
        }).then((template) => {
            getEventTemplateSubject(template);
            getEventTemplateBody(template);
            return templateCache.set(templateUrl, template, 60000);
        }).catch((error) => {
            error.templateUrl = templateUrl;
            throw error;
        }).finally(() => pendingTemplates.delete(templateUrl)));
    }
    return pendingTemplates.get(templateUrl);
};

const getOrAssignTdScratchCode = async ({ eventClaimId, slugUrl }) => {
    const { TD_Scratch_Codes, Event_Claims } = models.active;

    if (!eventClaimId || !TD_Scratch_Codes) return "";
    if (slugUrl !== "2degrees-bonus") return "";

    return sequelize.transaction(async (transaction) => {
        const claim = await Event_Claims.findByPk(eventClaimId, { transaction, lock: true });
        if (!claim) throw new Error("Event claim not found for scratch code assignment.");
        const existingCode = await TD_Scratch_Codes.findOne({
            where: { event_claim_id: eventClaimId }, transaction,
        });
        if (existingCode) return existingCode.td_code;

        const availableCode = await TD_Scratch_Codes.findOne({
            where: {
                used: 0,
                event_claim_id: { [Op.is]: null },
            },
            order: [["id", "ASC"]], transaction, lock: true,
        });
        if (!availableCode) throw new Error("No available TD scratch code.");
        await availableCode.update({ event_claim_id: eventClaimId, used: 1 }, { transaction });
        return availableCode.td_code;
    });
};

const buildEventEmailVariables = async ({
    rawTemplate,
    fullName,
    eventClaimId,
    slugUrl,
}) => {
    const variables = {
        full_name: fullName,
    };
    const tdScratchCodeKeys = [
        "td_scratch_codes.td_code",
        "td_scratch_code.td_code",
        "TD_Scratch_Codes.td_code",
    ];

    if (templateUsesVariable(rawTemplate, tdScratchCodeKeys)) {
        const tdCode = await getOrAssignTdScratchCode({
            eventClaimId,
            slugUrl,
        });

        tdScratchCodeKeys.forEach((key) => {
            variables[key] = tdCode;
        });
    }

    return variables;
};

const sendEventConfirmationEmail = async ({
    slugUrl,
    recipientEmail,
    fullName,
    eventClaimId,
}) => {
    const cleanSlugUrl = normalizeText(slugUrl);
    const cleanRecipientEmail = normalizeText(recipientEmail);
    const cleanFullName = normalizeText(fullName);

    if (!isEmailConfigured()) {
        throw new Error("Event confirmation email SMTP configuration is incomplete.");
    }

    if (!cleanSlugUrl || !cleanRecipientEmail) {
        throw new Error("Event confirmation email data is incomplete.");
    }

    const rawTemplate = await fetchEventEmailTemplate(cleanSlugUrl);
    const variables = await buildEventEmailVariables({
        rawTemplate,
        fullName: cleanFullName,
        eventClaimId,
        slugUrl: cleanSlugUrl,
    });
    const template = renderTemplateValue(rawTemplate, variables);
    const subject = getEventTemplateSubject(template);
    const text = getEventTemplateBody(template);

    await getTransporter().sendMail({
        from: `OPPO NZ Promotions <${config.email.from}>`,
        to: cleanRecipientEmail,
        subject,
        text,
    });

    return true;
};

const logEventEmailFailure = async ({ slugUrl, recipientEmail, error }) => {
    await writeLog("error", {
        type: "event_confirmation_email",
        slugUrl,
        recipientEmail,
        message: error.message,
        status: error.status,
        templateUrl: error.templateUrl,
        responsePreview: error.responsePreview,
        code: error.code,
        responseCode: error.responseCode,
        response: error.response,
        command: error.command,
    });
};

const queueEventConfirmationEmail = ({
    slugUrl,
    recipientEmail,
    fullName,
    eventClaimId,
}) => {
    setImmediate(() => {
        sendEventConfirmationEmail({
            slugUrl,
            recipientEmail,
            fullName,
            eventClaimId,
        }).catch((error) => {
            return logEventEmailFailure({
                slugUrl,
                recipientEmail,
                error,
            });
        }).catch((error) => console.error("Failed to log event email failure:", error.message));
    });
};

module.exports = {
    queueEventConfirmationEmail,
    sendEventConfirmationEmail,
};
