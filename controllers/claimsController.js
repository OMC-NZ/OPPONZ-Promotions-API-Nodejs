const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize, models } = require("../models");
const { getNewZealandTime, toNewZealandDateTime } = require("../utils/nzTimeZone");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const CLAIM_STATUS_PENDING = 0;
const DEVICE_REDEMPTION_STATUS_CLAIMED = 1;

const normalizeText = (value) => String(value || "").trim();

const submitClaim = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            promotion_id: promotionId,
            imei,
            purchase_date: purchaseDateInput,
            receipt_url: receiptUrl,
            screenshot_url: screenshotUrl,
            first_name: firstName,
            last_name: lastName,
            email,
            contact,
            street,
            suburb,
            postcode,
            instructions,
            gift_alias: giftAlias,
            giftAlias: giftAliasCamel,
            alias,
        } = req.body;
        const selectedGiftAlias = giftAlias || giftAliasCamel || alias;
        const city = normalizeText(req.body.city || req.body.CityTown);
        const now = getNewZealandTime();
        const purchaseDate = toNewZealandDateTime(purchaseDateInput);

        if (!selectedGiftAlias) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 400,
                message: "Gift alias is required.",
                code: "GIFT_ALIAS_REQUIRED",
            });
        }

        const {
            Customers,
            Claims,
            Deliver_Addresses,
            Devices,
            Gifts,
            Promotions,
            Promotion_Gifts,
            Claim_Gifts,
        } = models.active;

        const [promotion, device, gift] = await Promise.all([
            Promotions.findByPk(promotionId, { transaction }),
            Devices.findOne({
                where: { imei },
                transaction,
                lock: true,
            }),
            Gifts.findOne({
                where: { alias: selectedGiftAlias },
                transaction,
            }),
        ]);

        if (!promotion) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 404,
                message: "Promotion not found.",
                code: "PROMOTION_NOT_FOUND",
            });
        }

        if (!device) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 404,
                message: "Device not found.",
                code: "DEVICE_NOT_FOUND",
            });
        }

        if (Number(device.redemption_status) !== 0) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 409,
                message: "This IMEI has already been used for a claim.",
                code: "IMEI_ALREADY_CLAIMED",
            });
        }

        if (!gift) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 404,
                message: "Gift not found.",
                code: "GIFT_NOT_FOUND",
            });
        }

        const promotionGift = await Promotion_Gifts.findOne({
            where: {
                promotion_id: promotionId,
                gift_id: gift.id,
            },
            transaction,
        });

        if (!promotionGift) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 400,
                message: "Selected gift is not available for this promotion.",
                code: "GIFT_NOT_AVAILABLE_FOR_PROMOTION",
            });
        }

        const duplicateClaim = await Claims.findOne({
            where: {
                [Op.or]: [
                    { imei },
                    {
                        promotion_id: promotionId,
                        receipt_url: receiptUrl,
                    },
                ],
            },
            transaction,
        });

        if (duplicateClaim) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 409,
                message: "This claim appears to have already been submitted.",
                code: "DUPLICATE_CLAIM",
            });
        }

        const customer = await Customers.create({
            first_name: firstName,
            last_name: lastName,
            email,
            contact,
            updated_at: now,
        }, { transaction });
        const claimId = crypto.randomUUID();

        await Claims.create({
            id: claimId,
            promotion_id: promotionId,
            imei,
            customer_id: customer.id,
            purchase_date: purchaseDate,
            status: CLAIM_STATUS_PENDING,
            receipt_url: receiptUrl,
            screenshot_url: screenshotUrl,
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
            data: {
                claim_id: claimId,
                customer_id: customer.id,
                promotion_id: Number(promotionId),
                imei,
                gift: {
                    id: gift.id,
                    alias: gift.alias,
                    name: gift.name,
                    color: gift.color,
                },
            },
        });
    } catch (error) {
        await transaction.rollback();
        error.status = 500;
        error.publicMessage = "Failed to submit claim.";
        return next(error);
    }
};

module.exports = {
    submitClaim,
};
