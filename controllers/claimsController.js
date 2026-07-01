const crypto = require("crypto");
const { sequelize, models } = require("../models");
const {
    EMAIL_STATUS_FAILED,
    queueClaimConfirmationEmail,
} = require("../services/claimConfirmationEmailService");
const { checkPromotionEligibility } = require("../services/promotionEligibilityService");
const { uploadFileToR2, validateFileForR2 } = require("../services/r2UploadService");
const { getNewZealandTime, toNewZealandDateTime } = require("../utils/nzTimeZone");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const CLAIM_STATUS_PENDING = 0;
const CLAIM_STATUS_SHIPPED = 2;
const DEVICE_REDEMPTION_STATUS_CLAIMED = 1;
const CLAIM_ID_PREFIX = "OPNZPROCLM";
const CLAIM_ID_RANDOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const normalizeText = (value) => String(value || "").trim();

const getUploadedFile = (req, fieldNames) => {
    const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];

    for (const fieldName of names) {
        const files = req.files?.[fieldName];
        if (Array.isArray(files) && files[0]) return files[0];
    }

    return null;
};

const formatGiftName = (gift) => {
    return [gift.name, gift.color]
        .map(normalizeText)
        .filter(Boolean)
        .join(" ");
};

const getClaimIdDatePart = (newZealandDateTime) => {
    return `${newZealandDateTime.slice(2, 4)}${newZealandDateTime.slice(5, 7)}${newZealandDateTime.slice(8, 10)}`;
};

const generateClaimIdRandomPart = () => {
    const randomBytes = crypto.randomBytes(8);

    return [...randomBytes]
        .map((byte) => CLAIM_ID_RANDOM_ALPHABET[byte % CLAIM_ID_RANDOM_ALPHABET.length])
        .join("");
};

const generateClaimId = (newZealandDateTime) => {
    return `${CLAIM_ID_PREFIX}-${getClaimIdDatePart(newZealandDateTime)}-${generateClaimIdRandomPart()}`;
};

const generateUniqueClaimId = async (Claims, newZealandDateTime, transaction) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const claimId = generateClaimId(newZealandDateTime);
        const existingClaim = await Claims.findByPk(claimId, { transaction });

        if (!existingClaim) return claimId;
    }

    throw new Error("Failed to generate a unique claim ID.");
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
    const transaction = await sequelize.transaction();

    try {
        const promotionId = req.body.promotion_id ?? req.body.promotionId;
        const purchaseDateInput = req.body.purchase_date ?? req.body.purchaseDate;
        const receiptUrl = req.body.receipt_url ?? req.body.receiptUrl;
        const screenshotUrl = req.body.screenshot_url ?? req.body.screenshotUrl;
        const receiptFile = getUploadedFile(req, ["receipt", "receipt_url", "receiptUrl"]);
        const screenshotFile = getUploadedFile(req, ["screenshot", "screenshot_url", "screenshotUrl"]);
        const firstName = req.body.first_name ?? req.body.firstName;
        const lastName = req.body.last_name ?? req.body.lastName;
        const {
            imei,
            email,
            contact,
            street,
            suburb,
            postcode,
            instructions,
            alias,
        } = req.body;
        const selectedGiftAlias = req.body.gift_alias || req.body.giftAlias || alias;
        const city = normalizeText(req.body.city || req.body.CityTown);
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
            ["gift_alias", selectedGiftAlias],
        ].filter(([, value]) => value === undefined || value === null || value === "");
        let storedReceiptUrl = normalizeText(receiptUrl);
        let storedScreenshotUrl = normalizeText(screenshotUrl);

        if (missingFields.length > 0) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 400,
                message: "Submission failed. Please check your details and submit again.",
                code: "CLAIM_REQUIRED_FIELDS_MISSING",
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        if (!purchaseDate) {
            await transaction.rollback();
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
            if (receiptFile) validateFileForR2(receiptFile);
            if (screenshotFile) validateFileForR2(screenshotFile);
        } catch (error) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: error.statusCode || 400,
                message: "Submission failed. Please check your files and submit again.",
                code: "CLAIM_FILE_VALIDATION_ERROR",
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
        } = models.active;

        const eligibility = await checkPromotionEligibility({
            imei,
            purchaseDateInput,
            promotionId,
            giftAlias: selectedGiftAlias,
            transaction,
        });

        if (!eligibility.eligible) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 400,
                message: "Submission failed. Please check your details and submit again.",
                code: "CLAIM_ELIGIBILITY_ERROR",
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        const { device, gift, promotion } = eligibility;

        if (receiptFile) {
            const receiptUpload = await uploadFileToR2({
                file: receiptFile,
                claimType: "promotions",
                slug: promotion.slug_url,
            });
            storedReceiptUrl = receiptUpload.key;
        }

        if (screenshotFile) {
            const screenshotUpload = await uploadFileToR2({
                file: screenshotFile,
                claimType: "promotions",
                slug: promotion.slug_url,
            });
            storedScreenshotUrl = screenshotUpload.key;
        }

        const customer = await Customers.create({
            first_name: firstName,
            last_name: lastName,
            email,
            contact,
            updated_at: now,
        }, { transaction });
        const claimId = await generateUniqueClaimId(Claims, now, transaction);

        await Claims.create({
            id: claimId,
            promotion_id: promotionId,
            imei,
            customer_id: customer.id,
            purchase_date: purchaseDate,
            status: CLAIM_STATUS_PENDING,
            receipt_url: storedReceiptUrl,
            screenshot_url: storedScreenshotUrl,
            email_status: EMAIL_STATUS_FAILED,
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

        await Claim_Gifts.create({
            claim_id: claimId,
            gift_id: gift.id,
        }, { transaction });

        await device.update({
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
                gift: formatGiftName(gift),
            },
        });
    } catch (error) {
        await transaction.rollback();
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
