const { normalizeText, formatGiftName } = require("../utils/text");
const { generateUniqueClaimId } = require("../utils/claimId");
const { rollbackTransaction } = require("../utils/dbTransaction");
const { sequelize, models, getDBModelContext } = require("../models");
const {
    EMAIL_STATUS_FAILED,
    queueClaimConfirmationEmail,
} = require("../services/claimConfirmationEmailService");
const { checkPromotionEligibility } = require("../services/promotionEligibilityService");
const { uploadClaimFile, validateClaimFile } = require("../services/claimFileUploadService");
const { getNewZealandTime, toNewZealandDateTime } = require("../utils/nzTimeZone");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const CLAIM_STATUS_PENDING = 0;
const CLAIM_STATUS_SHIPPED = 2;
const DEVICE_REDEMPTION_STATUS_CLAIMED = 1;
const CLAIM_ID_PREFIX = "OPNZPROCLM";

const getUploadedFile = (req, fieldNames) => {
    const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];

    for (const fieldName of names) {
        const files = req.files?.[fieldName];
        if (Array.isArray(files) && files[0]) return files[0];
    }

    return null;
};

const getCurrentTrackLink = (deliverAddresses = []) => {
    const currentAddresses = deliverAddresses
        .filter((address) => Number(address.is_current) === 1)
        .sort((a, b) => Number(b.id) - Number(a.id));
    const addresses = currentAddresses.length > 0 ? currentAddresses : deliverAddresses;

    for (const address of addresses) {
        const trackTraces = [...(address.trackTraces || [])]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const trackTrace = trackTraces.find((item) => item.track_link);

        if (trackTrace) return trackTrace.track_link;
    }

    return null;
};

const getClaimStatus = async (req, res, next) => {
    try {
        const claimId = normalizeText(req.body.claim_id);
        const email = normalizeText(req.body.email).toLowerCase();
        const {
            Claims,
            Customers,
            Deliver_Addresses,
            Track_Trace,
        } = models.active;

        if (!claimId) {
            return sendSuccess(req, res, {
                includeRequestId: false,
                data: {
                    verified: false,
                },
                message: "Claim details could not be verified.",
            });
        }

        const claim = await Claims.findByPk(claimId, {
            attributes: ["id", "status", "customer_id"],
            include: [
                {
                    model: Customers,
                    as: "customer",
                    attributes: ["email"],
                    required: true,
                },
                {
                    model: Deliver_Addresses,
                    as: "deliverAddresses",
                    attributes: ["id", "is_current"],
                    required: false,
                    include: [
                        {
                            model: Track_Trace,
                            as: "trackTraces",
                            attributes: ["track_link", "created_at"],
                            required: false,
                        },
                    ],
                },
            ],
        });

        if (!claim || normalizeText(claim.customer?.email).toLowerCase() !== email) {
            return sendSuccess(req, res, {
                includeRequestId: false,
                data: {
                    verified: false,
                },
                message: "Claim details could not be verified.",
            });
        }

        const data = {
            verified: true,
            status: claim.status,
        };

        if (Number(claim.status) === CLAIM_STATUS_SHIPPED) {
            data.track_link = getCurrentTrackLink(claim.deliverAddresses);
        }

        return sendSuccess(req, res, {
            includeRequestId: false,
            data,
        });
    } catch (error) {
        error.status = 500;
        error.publicMessage = "Failed to retrieve claim status.";
        error.includeRequestId = false;
        error.includeCode = false;
        error.includeDebug = false;
        return next(error);
    }
};

const submitClaim = async (req, res, next) => {
    let transaction;

    try {
        const promotionId = req.body.promotion_id;
        const purchaseDateInput = req.body.purchase_date;
        const receiptUrl = req.body.receipt_url;
        const screenshotUrl = req.body.screenshot_url;
        const invoiceCode = normalizeText(req.body.invoicenumber);
        const receiptFile = getUploadedFile(req, "receipt");
        const screenshotFile = getUploadedFile(req, "screenshot");
        const firstName = req.body.first_name;
        const lastName = req.body.last_name;
        const {
            imei,
            email,
            contact,
            street,
            suburb,
            postcode,
            instructions,
        } = req.body;
        const selectedGiftAliases = req.body.gift_alias;
        const city = normalizeText(req.body.city);
        const now = getNewZealandTime();
        const purchaseDate = toNewZealandDateTime(purchaseDateInput);
        const missingFields = [
            ["promotion_id", promotionId],
            ["imei", imei],
            ["purchase_date", purchaseDateInput],
            ["receipt", receiptUrl || receiptFile],
            ["screenshot", screenshotUrl || screenshotFile],
            ["first_name", firstName],
            ["last_name", lastName],
            ["email", email],
            ["contact", contact],
            ["street", street],
            ["suburb", suburb],
            ["city", city],
            ["postcode", postcode],
            ["invoicenumber", invoiceCode],
            ["gift_alias", selectedGiftAliases],
        ].filter(([, value]) => value === undefined || value === null || value === "");
        let storedReceiptUrl = normalizeText(receiptUrl);
        let storedScreenshotUrl = normalizeText(screenshotUrl);

        if (missingFields.length > 0) {
            return sendError(req, res, {
                statusCode: 400,
                message: "Submission failed. Please check your details and submit again.",
                code: "CLAIM_REQUIRED_FIELDS_MISSING",
                debug: { missingFields: missingFields.map(([field]) => field) },
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        if (!purchaseDate) {
            return sendError(req, res, {
                statusCode: 400,
                message: "Submission failed. Please check your details and submit again.",
                code: "CLAIM_INVALID_PURCHASE_DATE",
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        try {
            if (receiptFile) validateClaimFile(receiptFile);
            if (screenshotFile) validateClaimFile(screenshotFile);
        } catch (error) {
            return sendError(req, res, {
                statusCode: error.statusCode || 400,
                message: "Submission failed. Please check your files and submit again.",
                code: "CLAIM_FILE_VALIDATION_ERROR",
                debug: { reason: error.message },
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        const {
            Customers,
            Claims,
            Deliver_Addresses,
            Claim_Gifts,
            Devices,
        } = models.active;

        const eligibility = await checkPromotionEligibility({
            imei,
            purchaseDateInput,
            promotionId,
            giftAliases: selectedGiftAliases,
            promotionContext: getDBModelContext(),
        });

        if (!eligibility.eligible) {
            return sendError(req, res, {
                statusCode: 400,
                message: "Submission failed. Please check your details and submit again.",
                code: "CLAIM_ELIGIBILITY_ERROR",
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
                debug: {
                    reason: eligibility.reason,
                    promotion_id: promotionId,
                    gift_alias: selectedGiftAliases,
                    hasPromotion: Boolean(eligibility.promotion),
                    hasDevice: Boolean(eligibility.device),
                    missingGiftAliases: eligibility.missingGiftAliases,
                    unlinkedGiftAliases: eligibility.unlinkedGiftAliases,
                    deviceModel: eligibility.device?.model,
                    deviceChannelCode: eligibility.device?.channel_code,
                    deviceRedemptionStatus: eligibility.device?.redemption_status,
                    eligiblePromotionIds: eligibility.eligiblePromotionIds,
                    purchaseDate: eligibility.purchaseDate,
                    requestTime: eligibility.requestTime,
                },
            });
        }

        const { device, gifts, promotion } = eligibility;

        if (receiptFile) {
            const receiptUpload = await uploadClaimFile({
                file: receiptFile,
                claimType: "promotions",
                slug: promotion.id,
            });
            storedReceiptUrl = receiptUpload.file_name;
        }

        if (screenshotFile) {
            const screenshotUpload = await uploadClaimFile({
                file: screenshotFile,
                claimType: "promotions",
                slug: promotion.id,
            });
            storedScreenshotUrl = screenshotUpload.file_name;
        }

        transaction = await sequelize.transaction();
        const lockedDevice = await Devices.findByPk(imei, { transaction, lock: true });
        if (!lockedDevice || Number(lockedDevice.redemption_status) !== 0
            || lockedDevice.model !== device.model || lockedDevice.channel_code !== device.channel_code) {
            await rollbackTransaction(transaction);
            return sendError(req, res, {
                statusCode: 400,
                message: "Submission failed. Please check your details and submit again.",
                code: "CLAIM_ELIGIBILITY_ERROR",
                debug: { reason: "DEVICE_CHANGED_OR_ALREADY_REDEEMED" },
                includeRequestId: false, includeCode: false, includeDebug: false,
            });
        }

        const customer = await Customers.create({
            first_name: firstName,
            last_name: lastName,
            email,
            contact,
            updated_at: now,
        }, { transaction });

        const claimId = await generateUniqueClaimId({ model: Claims, prefix: CLAIM_ID_PREFIX, dateTime: now, transaction });

        await Claims.create({
            id: claimId,
            promotion_id: promotionId,
            imei,
            customer_id: customer.id,
            purchase_date: purchaseDate,
            status: CLAIM_STATUS_PENDING,
            receipt_url: storedReceiptUrl,
            screenshot_url: storedScreenshotUrl,
            invoicecode: invoiceCode,
            email_status: EMAIL_STATUS_FAILED,
            created_at: now,
            updated_at: now,
        }, { transaction });

        await Deliver_Addresses.create({
            claim_id: claimId,
            street,
            suburb,
            city,
            postcode,
            instructions: instructions || null,
            is_current: 1,
            updated_at: now,
        }, { transaction });

        await Claim_Gifts.bulkCreate(gifts.map((gift) => ({
            claim_id: claimId,
            gift_id: gift.id,
        })), { transaction });

        await lockedDevice.update({
            redemption_status: DEVICE_REDEMPTION_STATUS_CLAIMED,
            updated_at: now,
        }, { transaction });

        await transaction.commit();
        queueClaimConfirmationEmail(claimId);

        return sendSuccess(req, res, {
            statusCode: 201,
            includeRequestId: false,
            data: {
                claim_id: claimId,
                gift: gifts.map(formatGiftName).join(", "),
            },
        });
    } catch (error) {
        await rollbackTransaction(transaction);
        error.status = 500;
        error.publicMessage = "Failed to submit claim.";
        error.includeRequestId = false;
        error.includeCode = false;
        error.includeDebug = false;
        return next(error);
    }
};

module.exports = {
    submitClaim,
    getClaimStatus,
};
