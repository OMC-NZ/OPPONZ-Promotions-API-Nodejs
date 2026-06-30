const { Op } = require("sequelize");
const { models } = require("../models");
const { getNewZealandTime } = require("../utils/nzTimeZone");
const { sendSuccess } = require("../utils/apiResponse");

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
            banner_url: process.env.PROMOTIONS_PUBLIC_ASSETS_URL
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
                        process.env.PROMOTIONS_PUBLIC_ASSETS_URL,
                        "/banners/Events/terms/",
                        event.terms_url
                    ),
                    banner_url: buildEventAssetUrl(
                        process.env.PROMOTIONS_PUBLIC_ASSETS_URL,
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

module.exports = {
    getCurrentEvents,
    getEventForm,
};
