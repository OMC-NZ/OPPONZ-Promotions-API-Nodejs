const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize, models } = require("../models");
const { uploadFileToR2, validateFileForR2 } = require("../services/r2UploadService");
const { getNewZealandTime } = require("../utils/nzTimeZone");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const EVENT_CLAIM_STATUS_PENDING = 0;
const EVENT_CLAIM_ID_PREFIX = "OPNZEVTCLM";
const EVENT_CLAIM_ID_RANDOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const normalizeText = (value) => String(value || "").trim();

const getEventClaimIdDatePart = (newZealandDateTime) => {
    return `${newZealandDateTime.slice(2, 4)}${newZealandDateTime.slice(5, 7)}${newZealandDateTime.slice(8, 10)}`;
};

const generateEventClaimIdRandomPart = () => {
    const randomBytes = crypto.randomBytes(8);

    return [...randomBytes]
        .map((byte) => EVENT_CLAIM_ID_RANDOM_ALPHABET[byte % EVENT_CLAIM_ID_RANDOM_ALPHABET.length])
        .join("");
};

const generateEventClaimId = (newZealandDateTime) => {
    return `${EVENT_CLAIM_ID_PREFIX}-${getEventClaimIdDatePart(newZealandDateTime)}-${generateEventClaimIdRandomPart()}`;
};

const generateUniqueEventClaimId = async (Event_Claims, newZealandDateTime, transaction) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const claimId = generateEventClaimId(newZealandDateTime);
        const existingClaim = await Event_Claims.findByPk(claimId, { transaction });

        if (!existingClaim) return claimId;
    }

    throw new Error("Failed to generate a unique event claim ID.");
};

const getEventFileFieldNames = (uploadKey) => {
    const key = normalizeText(uploadKey);

    return [
        key,
        `${key}[]`,
        `uploads[${key}]`,
        `uploads.${key}`,
    ];
};

const getFilesForUploadKey = (files, uploadKey) => {
    const acceptedNames = new Set(getEventFileFieldNames(uploadKey));

    return files.filter((file) => acceptedNames.has(file.fieldname));
};

const getKnownEventBodyKeys = () => new Set([
    "imei",
    "first_name",
    "firstName",
    "last_name",
    "lastName",
    "email",
    "contact",
    "street",
    "suburb",
    "city",
    "CityTown",
    "postcode",
    "instructions",
    "recaptcha_token",
    "recaptchaToken",
    "token",
    "recaptcha_action",
    "recaptchaAction",
    "action",
]);

const getCurrentEvents = async (req, res, next) => {
    try {
        const currentTime = getNewZealandTime();
        const { Events } = models.active;

        const events = await Events.findAll({
            attributes: [
                "name",
                "banner_url",
                "slug_url",
            ],
            where: {
                start_date: {
                    [Op.lte]: currentTime,
                },
                end_date: {
                    [Op.gte]: currentTime,
                },
            },
            order: [["id", "DESC"]],
            raw: true,
        });

        const eventsWithBannerUrls = events.map((event) => ({
            ...event,
            banner_url: process.env.R2_PUBLIC_ASSETS_URL
                + "/banners/Events/imgs/"
                + event.banner_url,
        }));

        return sendSuccess(req, res, {
            data: eventsWithBannerUrls,
        });
    } catch (error) {
        error.status = 500;
        error.publicMessage = "Failed to fetch current events.";
        return next(error);
    }
};

const buildEventAssetUrl = (baseUrl, path, fileName) => {
    return `${String(baseUrl || "").replace(/\/+$/, "")}${path}${fileName}`;
};

const parseValidationJson = (value) => {
    if (!value) return null;

    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
};

const getEventForm = async (req, res, next) => {
    try {
        const currentTime = getNewZealandTime();
        const slug = String(req.params.slug || "").trim();
        const {
            Events,
            Event_Form_Sections,
            Event_Form_Custom_Fields,
            Event_Form_Field_Options,
            Event_Form_Uploads,
        } = models.active;

        const event = await Events.findOne({
            attributes: [
                "id",
                "name",
                "terms_url",
                "banner_url",
                "slug_url",
                "requires_imei",
                "requires_channel",
                "requires_delivery",
            ],
            where: {
                slug_url: slug,
                start_date: {
                    [Op.lte]: currentTime,
                },
                end_date: {
                    [Op.gte]: currentTime,
                },
            },
            raw: true,
        });

        if (!event) {
            return sendSuccess(req, res, {
                data: null,
            });
        }

        const [sections, uploads] = await Promise.all([
            Event_Form_Sections.findAll({
                attributes: ["id", "section_title", "sort_order"],
                where: {
                    event_id: event.id,
                },
                order: [["sort_order", "ASC"], ["id", "ASC"]],
                raw: true,
            }),
            Event_Form_Uploads.findAll({
                attributes: ["id", "upload_key", "upload_label"],
                where: {
                    event_id: event.id,
                },
                order: [["id", "ASC"]],
                raw: true,
            }),
        ]);

        const sectionIds = sections.map((section) => section.id);
        const fields = sectionIds.length === 0
            ? []
            : await Event_Form_Custom_Fields.findAll({
                attributes: [
                    "id",
                    "section_id",
                    "field_key",
                    "field_label",
                    "field_type",
                    "placeholder",
                    "is_required",
                    "sort_order",
                    "validation_json",
                ],
                where: {
                    section_id: {
                        [Op.in]: sectionIds,
                    },
                },
                order: [["sort_order", "ASC"], ["id", "ASC"]],
                raw: true,
            });

        const fieldIds = fields.map((field) => field.id);
        const options = fieldIds.length === 0
            ? []
            : await Event_Form_Field_Options.findAll({
                attributes: ["id", "field_id", "option_value", "option_label", "sort_order"],
                where: {
                    field_id: {
                        [Op.in]: fieldIds,
                    },
                },
                order: [["sort_order", "ASC"], ["id", "ASC"]],
                raw: true,
            });

        const optionsByField = new Map();
        options.forEach((option) => {
            const fieldId = String(option.field_id);
            if (!optionsByField.has(fieldId)) {
                optionsByField.set(fieldId, []);
            }
            optionsByField.get(fieldId).push({
                id: option.id,
                option_value: option.option_value,
                option_label: option.option_label,
                sort_order: option.sort_order,
            });
        });

        const fieldsBySection = new Map();
        fields.forEach((field) => {
            const sectionId = String(field.section_id);
            if (!fieldsBySection.has(sectionId)) {
                fieldsBySection.set(sectionId, []);
            }
            fieldsBySection.get(sectionId).push({
                id: field.id,
                field_key: field.field_key,
                field_label: field.field_label,
                field_type: field.field_type,
                placeholder: field.placeholder,
                is_required: field.is_required,
                sort_order: field.sort_order,
                validation: parseValidationJson(field.validation_json),
                options: optionsByField.get(String(field.id)) || [],
            });
        });

        return sendSuccess(req, res, {
            data: {
                event: {
                    id: event.id,
                    name: event.name,
                    terms_url: buildEventAssetUrl(
                        process.env.R2_PUBLIC_ASSETS_URL,
                        "/banners/Events/terms/",
                        event.terms_url
                    ),
                    banner_url: buildEventAssetUrl(
                        process.env.R2_PUBLIC_ASSETS_URL,
                        "/banners/Events/imgs/",
                        event.banner_url
                    ),
                    slug_url: event.slug_url,
                    requires_imei: event.requires_imei,
                    requires_channel: event.requires_channel,
                    requires_delivery: event.requires_delivery,
                },
                sections: sections.map((section) => ({
                    id: section.id,
                    section_title: section.section_title,
                    sort_order: section.sort_order,
                    fields: fieldsBySection.get(String(section.id)) || [],
                })),
                uploads: uploads.map((upload) => ({
                    id: upload.id,
                    upload_key: upload.upload_key,
                    upload_label: upload.upload_label,
                })),
            },
        });
    } catch (error) {
        error.status = 500;
        error.publicMessage = "Failed to fetch event form.";
        return next(error);
    }
};

const getEventDeviceVerification = async ({ event, imei, transaction }) => {
    const {
        Devices,
        Event_Channels,
        Event_Models,
        Event_Claims,
    } = models.active;

    const [device, existingEventClaim] = await Promise.all([
        Devices.findOne({
            attributes: ["imei", "channel_code", "model"],
            where: { imei },
            transaction,
            raw: true,
        }),
        Event_Claims.findOne({
            attributes: ["id"],
            where: { imei },
            transaction,
            raw: true,
        }),
    ]);

    if (!device || existingEventClaim) {
        return {
            verified: false,
            device,
        };
    }

    if (Number(event.requires_channel) !== 1) {
        return {
            verified: true,
            device,
        };
    }

    if (!device.channel_code || !device.model) {
        return {
            verified: false,
            device,
        };
    }

    const [
        hasChannelRestriction,
        matchingEventChannel,
        hasModelRestriction,
        matchingEventModel,
    ] = await Promise.all([
        Event_Channels.findOne({
            attributes: ["id"],
            where: { event_id: event.id },
            transaction,
            raw: true,
        }),
        Event_Channels.findOne({
            attributes: ["id"],
            where: {
                event_id: event.id,
                channel_code: device.channel_code,
            },
            transaction,
            raw: true,
        }),
        Event_Models.findOne({
            attributes: ["id"],
            where: { event_id: event.id },
            transaction,
            raw: true,
        }),
        Event_Models.findOne({
            attributes: ["id"],
            where: {
                event_id: event.id,
                eligible_model: device.model,
            },
            transaction,
            raw: true,
        }),
    ]);

    const channelVerified = !hasChannelRestriction || Boolean(matchingEventChannel);
    const modelVerified = !hasModelRestriction || Boolean(matchingEventModel);

    return {
        verified: channelVerified && modelVerified,
        device,
    };
};

const submitEventClaim = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const currentTime = getNewZealandTime();
        const slug = normalizeText(req.params.slug);
        const firstName = req.body.first_name ?? req.body.firstName;
        const lastName = req.body.last_name ?? req.body.lastName;
        const city = normalizeText(req.body.city || req.body.CityTown);
        const imei = normalizeText(req.body.imei);
        const files = Array.isArray(req.files) ? req.files : [];
        const {
            email,
            contact,
            street,
            suburb,
            postcode,
            instructions,
        } = req.body;
        const {
            Events,
            Customers,
            Event_Claims,
            Event_Form_Sections,
            Event_Form_Custom_Fields,
            Event_Form_Uploads,
        } = models.active;

        const event = await Events.findOne({
            where: {
                slug_url: slug,
                start_date: {
                    [Op.lte]: currentTime,
                },
                end_date: {
                    [Op.gte]: currentTime,
                },
            },
            transaction,
            raw: true,
        });

        if (!event) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 404,
                message: "Event could not be found.",
                code: "EVENT_NOT_FOUND",
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        const missingFields = [
            ["first_name", firstName],
            ["last_name", lastName],
            ["email", email],
            ["contact", contact],
        ];

        if (Number(event.requires_imei) === 1 || Number(event.requires_channel) === 1) {
            missingFields.push(["imei", imei]);
        }

        if (Number(event.requires_delivery) === 1) {
            missingFields.push(
                ["street", street],
                ["suburb", suburb],
                ["city", city],
                ["postcode", postcode]
            );
        }

        const missingRequiredFields = missingFields
            .filter(([, value]) => value === undefined || value === null || value === "");

        if (missingRequiredFields.length > 0) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 400,
                message: "Submission failed. Please check your details and submit again.",
                code: "EVENT_CLAIM_REQUIRED_FIELDS_MISSING",
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        if (Number(event.requires_imei) === 1 || Number(event.requires_channel) === 1) {
            const verification = await getEventDeviceVerification({
                event,
                imei,
                transaction,
            });

            if (!verification.verified) {
                await transaction.rollback();
                return sendError(req, res, {
                    statusCode: 400,
                    message: "Submission failed. Please check your details and submit again.",
                    code: "EVENT_CLAIM_DEVICE_NOT_ELIGIBLE",
                    includeRequestId: false,
                    includeCode: false,
                    includeDebug: false,
                });
            }
        }

        const sections = await Event_Form_Sections.findAll({
            attributes: ["id"],
            where: {
                event_id: event.id,
            },
            transaction,
            raw: true,
        });
        const sectionIds = sections.map((section) => section.id);
        const customFields = sectionIds.length === 0
            ? []
            : await Event_Form_Custom_Fields.findAll({
                attributes: ["field_key", "field_label", "is_required"],
                where: {
                    section_id: {
                        [Op.in]: sectionIds,
                    },
                },
                transaction,
                raw: true,
            });
        const requiredCustomFields = customFields
            .filter((field) => Number(field.is_required) === 1)
            .filter((field) => normalizeText(req.body[field.field_key]) === "");

        if (requiredCustomFields.length > 0) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 400,
                message: "Submission failed. Please check your details and submit again.",
                code: "EVENT_CLAIM_CUSTOM_FIELDS_MISSING",
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        const uploadDefinitions = await Event_Form_Uploads.findAll({
            attributes: ["upload_key", "upload_label"],
            where: {
                event_id: event.id,
            },
            transaction,
            raw: true,
        });
        const allowedFileFieldNames = new Set(uploadDefinitions
            .flatMap((upload) => getEventFileFieldNames(upload.upload_key)));
        const unknownFiles = files
            .filter((file) => !allowedFileFieldNames.has(file.fieldname));

        if (unknownFiles.length > 0) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: 400,
                message: "Submission failed. Please check your files and submit again.",
                code: "EVENT_CLAIM_UNKNOWN_UPLOAD_FIELD",
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        for (const upload of uploadDefinitions) {
            const uploadFiles = getFilesForUploadKey(files, upload.upload_key);

            if (uploadFiles.length === 0) {
                await transaction.rollback();
                return sendError(req, res, {
                    statusCode: 400,
                    message: "Submission failed. Please check your files and submit again.",
                    code: "EVENT_CLAIM_UPLOAD_REQUIRED",
                    includeRequestId: false,
                    includeCode: false,
                    includeDebug: false,
                });
            }
        }

        try {
            files.forEach(validateFileForR2);
        } catch (error) {
            await transaction.rollback();
            return sendError(req, res, {
                statusCode: error.statusCode || 400,
                message: "Submission failed. Please check your files and submit again.",
                code: "EVENT_CLAIM_FILE_VALIDATION_ERROR",
                includeRequestId: false,
                includeCode: false,
                includeDebug: false,
            });
        }

        const uploadedFilesByKey = {};

        for (const upload of uploadDefinitions) {
            const uploadFiles = getFilesForUploadKey(files, upload.upload_key);
            const uploadedFiles = [];

            for (const file of uploadFiles) {
                const uploadedFile = await uploadFileToR2({
                    file,
                    claimType: "events",
                    slug: event.slug_url,
                });

                uploadedFiles.push({
                    key: uploadedFile.key,
                    url: uploadedFile.url,
                    file_name: uploadedFile.file_name,
                    original_name: uploadedFile.original_name,
                    content_type: uploadedFile.content_type,
                    size: uploadedFile.size,
                });
            }

            uploadedFilesByKey[upload.upload_key] = uploadedFiles;
        }

        const knownBodyKeys = getKnownEventBodyKeys();
        const customData = {};

        customFields.forEach((field) => {
            if (req.body[field.field_key] !== undefined) {
                customData[field.field_key] = req.body[field.field_key];
            }
        });

        Object.entries(req.body).forEach(([key, value]) => {
            if (!knownBodyKeys.has(key) && customData[key] === undefined) {
                customData[key] = value;
            }
        });

        const customer = await Customers.create({
            first_name: firstName,
            last_name: lastName,
            email,
            contact,
            updated_at: currentTime,
        }, { transaction });
        const eventClaimId = await generateUniqueEventClaimId(Event_Claims, currentTime, transaction);

        await Event_Claims.create({
            id: eventClaimId,
            event_id: event.id,
            imei,
            customer_id: customer.id,
            status: EVENT_CLAIM_STATUS_PENDING,
            extra_data: JSON.stringify({
                fields: customData,
                delivery: Number(event.requires_delivery) === 1
                    ? {
                        street,
                        suburb,
                        city,
                        postcode,
                        instructions: instructions || null,
                    }
                    : null,
                uploads: uploadedFilesByKey,
            }),
            updated_at: currentTime,
        }, { transaction });

        await transaction.commit();

        return sendSuccess(req, res, {
            statusCode: 201,
            includeRequestId: false,
            data: {
                event_claim_id: eventClaimId,
            },
        });
    } catch (error) {
        await transaction.rollback();
        error.status = 500;
        error.publicMessage = "Failed to submit event claim.";
        error.includeRequestId = false;
        error.includeCode = false;
        error.includeDebug = false;
        return next(error);
    }
};

module.exports = {
    getCurrentEvents,
    getEventForm,
    submitEventClaim,
};
