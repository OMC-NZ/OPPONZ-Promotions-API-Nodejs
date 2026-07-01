const nodemailer = require("nodemailer");
const config = require("../config/envConfig");
const { models } = require("../models");
const { getNewZealandTime } = require("../utils/nzTimeZone");
const { writeLog } = require("./logService");

const EMAIL_STATUS_FAILED = 0;
const EMAIL_STATUS_SENT = 1;
const SUBJECT = "OPPONZ Promotions Claim Confirmation";

let transporter;

const isEmailConfigured = () => Boolean(
    config.email.host &&
    config.email.port &&
    config.email.user &&
    config.email.pass &&
    config.email.from
);

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: false,
            requireTLS: true,
            auth: {
                user: config.email.user,
                pass: config.email.pass,
            },
        });
    }

    return transporter;
};

const escapeHtml = (value) => {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

const normalizeText = (value) => String(value || "").trim();

const formatGiftName = (gift) => {
    return [gift?.name, gift?.color]
        .map(normalizeText)
        .filter(Boolean)
        .join(" ");
};

const formatFullName = (customer) => {
    return [customer?.first_name, customer?.last_name]
        .map(normalizeText)
        .filter(Boolean)
        .join(" ");
};

const formatDeliveryAddress = (address) => {
    return [
        address?.street,
        address?.suburb,
        address?.city,
        address?.postcode,
    ]
        .map(normalizeText)
        .filter(Boolean)
        .join(", ");
};

const serializeEmailError = (error) => ({
    message: error?.message,
    code: error?.code,
    responseCode: error?.responseCode,
    response: error?.response,
    command: error?.command,
});

const buildClaimConfirmationEmailHtml = ({
    fullName,
    claimId,
    gift,
    deliveryAddress,
}) => {
    const safeFullName = escapeHtml(fullName || "there");
    const safeClaimId = escapeHtml(claimId);
    const safeGift = escapeHtml(gift);
    const safeDeliveryAddress = escapeHtml(deliveryAddress);

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;margin:0;padding:0;">
    <tr>
      <td align="left">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;">
          <tr>
            <td style="padding:0 42px 42px 42px;font-size:18px;line-height:1.55;">
              <h1 style="margin:0 0 18px 0;font-size:28px;line-height:1.25;font-weight:700;color:#000000;">Hi ${safeFullName},</h1>
              <p style="margin:0 0 20px 0;">We have received your OPPO Promotions claim.</p>
              <p style="margin:0 0 30px 0;">Our team will review your claim and, once approved, pass the relevant information to our logistics partner for delivery.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid #dddddd;border-radius:8px;overflow:hidden;margin:0 0 36px 0;">
                <tr>
                  <td style="width:34%;padding:20px 26px;border-right:1px solid #dddddd;border-bottom:1px solid #dddddd;font-weight:700;">Claim reference</td>
                  <td style="padding:20px 26px;border-bottom:1px solid #dddddd;">${safeClaimId}</td>
                </tr>
                <tr>
                  <td style="width:34%;padding:20px 26px;border-right:1px solid #dddddd;border-bottom:1px solid #dddddd;font-weight:700;">Selected gift</td>
                  <td style="padding:20px 26px;border-bottom:1px solid #dddddd;font-weight:700;">${safeGift}</td>
                </tr>
                <tr>
                  <td style="width:34%;padding:20px 26px;border-right:1px solid #dddddd;font-weight:700;">Delivery address</td>
                  <td style="padding:20px 26px;">${safeDeliveryAddress}</td>
                </tr>
              </table>

              <h2 style="margin:0 0 18px 0;font-size:24px;line-height:1.3;font-weight:700;color:#000000;">Track your claim</h2>
              <p style="margin:0 0 22px 0;">You can use your claim reference to track the progress of your claim at <a href="${config.email.trackingUrl}" style="color:#0057B8;text-decoration:none;">oppopromotions.co.nz</a>. Simply enter the claim reference in the tracking field provided on the website.</p>
              <p style="margin:0 0 34px 0;">Please allow up to 20 working days for processing and delivery. We will do our best to complete this as soon as possible.</p>
              <p style="margin:0 0 34px 0;">If you have any questions, please contact us at <a href="mailto:${config.email.serviceEmail}" style="color:#0057B8;text-decoration:none;">${config.email.serviceEmail}</a>.</p>
              <p style="margin:0 0 24px 0;">Thank you for your purchase.</p>
              <p style="margin:0;">Warm regards,<br><strong>OPPO New Zealand</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const buildClaimConfirmationEmailText = ({
    fullName,
    claimId,
    gift,
    deliveryAddress,
}) => [
    `Hi ${fullName || "there"},`,
    "",
    "We have received your OPPO Promotions claim.",
    "Our team will review your claim and, once approved, pass the relevant information to our logistics partner for delivery.",
    "",
    `Claim reference: ${claimId}`,
    `Selected gift: ${gift}`,
    `Delivery address: ${deliveryAddress}`,
    "",
    "Track your claim",
    `You can use your claim reference to track the progress of your claim at ${config.email.trackingUrl}.`,
    "",
    "Please allow up to 20 working days for processing and delivery. We will do our best to complete this as soon as possible.",
    "",
    `If you have any questions, please contact us at ${config.email.serviceEmail}.`,
    "",
    "Thank you for your purchase.",
    "",
    "Warm regards,",
    "",
    "OPPO New Zealand",
].join("\n");

const loadClaimEmailData = async (claimId) => {
    const {
        Claims,
        Customers,
        Deliver_Addresses,
        Claim_Gifts,
        Gifts,
    } = models.active;

    const claim = await Claims.findByPk(claimId);
    if (!claim) return null;

    const [customer, address, claimGift] = await Promise.all([
        Customers.findByPk(claim.customer_id),
        Deliver_Addresses.findOne({ where: { claim_id: claimId, is_current: 1 } }),
        Claim_Gifts.findOne({ where: { claim_id: claimId } }),
    ]);
    const gift = claimGift ? await Gifts.findByPk(claimGift.gift_id) : null;

    return {
        claim,
        customer,
        address,
        gift,
        fullName: formatFullName(customer),
        giftName: formatGiftName(gift),
        deliveryAddress: formatDeliveryAddress(address),
    };
};

const updateClaimEmailStatus = async (claimId, emailStatus) => {
    const { Claims } = models.active;

    await Claims.update({
        email_status: emailStatus,
        updated_at: getNewZealandTime(),
    }, {
        where: { id: claimId },
    });
};

const logClaimEmailFailure = async ({ claimId, recipientEmail, error }) => {
    await writeLog("error", {
        type: "claim_confirmation_email",
        claimId,
        recipientEmail,
        message: error.message,
        code: error.code,
        responseCode: error.responseCode,
        response: error.response,
        command: error.command,
    });
};

const sendAdminEmailFailureAlert = async ({ claimId, recipientEmail, error }) => {
    if (!config.email.adminEmail || !isEmailConfigured()) {
        return false;
    }

    try {
        await getTransporter().sendMail({
            from: `OPPO NZ Promotions <${config.email.from}>`,
            to: config.email.adminEmail,
            subject: `[OPPO Promotions] Claim confirmation email failed - ${claimId}`,
            text: [
                "A claim confirmation email failed to send.",
                "",
                `Claim ID: ${claimId}`,
                `Recipient: ${recipientEmail || "N/A"}`,
                "",
                "Error:",
                JSON.stringify(serializeEmailError(error), null, 2),
            ].join("\n"),
        });
        return true;
    } catch (alertError) {
        await writeLog("error", {
            type: "claim_confirmation_email_admin_alert",
            claimId,
            recipientEmail,
            message: alertError.message,
            code: alertError.code,
            responseCode: alertError.responseCode,
            response: alertError.response,
            command: alertError.command,
        });
        return false;
    }
};

const sendClaimConfirmationEmail = async (claimId) => {
    const data = await loadClaimEmailData(claimId);
    const recipientEmail = data?.customer?.email;

    if (!isEmailConfigured()) {
        const error = new Error("Claim confirmation email SMTP configuration is incomplete.");
        await updateClaimEmailStatus(claimId, EMAIL_STATUS_FAILED);
        await logClaimEmailFailure({ claimId, recipientEmail, error });
        await sendAdminEmailFailureAlert({ claimId, recipientEmail, error });
        return false;
    }

    if (!data?.claim || !recipientEmail) {
        const error = new Error("Claim confirmation email data is incomplete.");
        await updateClaimEmailStatus(claimId, EMAIL_STATUS_FAILED);
        await logClaimEmailFailure({ claimId, recipientEmail, error });
        await sendAdminEmailFailureAlert({ claimId, recipientEmail, error });
        return false;
    }

    try {
        await getTransporter().sendMail({
            from: `OPPO NZ Promotions <${config.email.from}>`,
            to: recipientEmail,
            subject: SUBJECT,
            text: buildClaimConfirmationEmailText({
                fullName: data.fullName,
                claimId,
                gift: data.giftName,
                deliveryAddress: data.deliveryAddress,
            }),
            html: buildClaimConfirmationEmailHtml({
                fullName: data.fullName,
                claimId,
                gift: data.giftName,
                deliveryAddress: data.deliveryAddress,
            }),
        });

        await updateClaimEmailStatus(claimId, EMAIL_STATUS_SENT);
        return true;
    } catch (error) {
        await updateClaimEmailStatus(claimId, EMAIL_STATUS_FAILED);
        await logClaimEmailFailure({ claimId, recipientEmail, error });
        await sendAdminEmailFailureAlert({ claimId, recipientEmail, error });

        return false;
    }
};

const queueClaimConfirmationEmail = (claimId) => {
    setImmediate(() => {
        sendClaimConfirmationEmail(claimId).catch((error) => {
            console.error("Claim confirmation email failed:", error.message);
        });
    });
};

const resendClaimConfirmationEmail = async (claimId) => {
    const data = await loadClaimEmailData(claimId);

    if (!data?.claim || Number(data.claim.email_status) !== EMAIL_STATUS_FAILED) {
        return false;
    }

    return sendClaimConfirmationEmail(claimId);
};

const verifyClaimEmailSmtpConnection = async () => {
    if (!isEmailConfigured()) return false;
    await getTransporter().verify();
    return true;
};

module.exports = {
    EMAIL_STATUS_FAILED,
    EMAIL_STATUS_SENT,
    buildClaimConfirmationEmailHtml,
    buildClaimConfirmationEmailText,
    queueClaimConfirmationEmail,
    resendClaimConfirmationEmail,
    sendClaimConfirmationEmail,
    verifyClaimEmailSmtpConnection,
};
