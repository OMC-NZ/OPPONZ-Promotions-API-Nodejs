const crypto = require("crypto");
const { sequelize, models } = require("../models");
const { checkPromotionEligibility } = require("../services/promotionEligibilityService");
const { getNewZealandTime, toNewZealandDateTime } = require("../utils/nzTimeZone");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const CLAIM_STATUS_PENDING = 0;
const DEVICE_REDEMPTION_STATUS_CLAIMED = 1;
const CLAIM_ID_PREFIX = "OPNZPROCLM";
const CLAIM_ID_RANDOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const normalizeText = (value) => String(value || "").trim();

const formatGiftName = (gift) => {
    return [gift.name, gift.color]
        .map(normalizeText)
        .filter(Boolean)
        .join(" ");
};

const replaceFileNameWithUuid = (fileUrl) => {
    const value = normalizeText(fileUrl);
    const queryIndex = value.search(/[?#]/);
    const pathPart = queryIndex === -1 ? value : value.slice(0, queryIndex);
    const suffix = queryIndex === -1 ? "" : value.slice(queryIndex);
    const slashIndex = Math.max(pathPart.lastIndexOf("/"), pathPart.lastIndexOf("\\"));
    const directory = slashIndex === -1 ? "" : pathPart.slice(0, slashIndex + 1);
    const fileName = slashIndex === -1 ? pathPart : pathPart.slice(slashIndex + 1);
    const dotIndex = fileName.lastIndexOf(".");
    const extension = dotIndex === -1 ? "" : fileName.slice(dotIndex);

    return `${directory}${crypto.randomUUID()}${extension}${suffix}`;
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

const submitClaim = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const promotionId = req.body.promotion_id ?? req.body.promotionId;
        const purchaseDateInput = req.body.purchase_date ?? req.body.purchaseDate;
        const receiptUrl = req.body.receipt_url ?? req.body.receiptUrl;
        const screenshotUrl = req.body.screenshot_url ?? req.body.screenshotUrl;
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
            ["receipt_url", receiptUrl],
            ["screenshot_url", screenshotUrl],
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
        const storedReceiptUrl = replaceFileNameWithUuid(receiptUrl);
        const storedScreenshotUrl = replaceFileNameWithUuid(screenshotUrl);

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

        const { device, gift } = eligibility;

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
};
