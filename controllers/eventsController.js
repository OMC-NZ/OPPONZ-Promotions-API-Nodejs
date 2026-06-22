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
                "terms_url",
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

module.exports = {
    getCurrentEvents,
};
