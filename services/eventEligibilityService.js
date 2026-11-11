const { models } = require("../models");

const getEventDeviceVerification = async ({ event, imei, transaction, lockDevice = false,
    checkRestrictions = Number(event.requires_channel) === 1 }) => {
    const { Devices, Event_Claims, Event_Channels, Event_Models } = models.active;
    // Lock the device before checking claims so concurrent submissions for this IMEI serialize.
    const device = await Devices.findOne({
        attributes: ["imei", "channel_code", "model"], where: { imei },
        transaction, ...(lockDevice ? { lock: true } : {}), raw: true,
    });
    if (!device) return { verified: false, device };
    const existingClaim = await Event_Claims.findOne({
        attributes: ["id"], where: { imei }, transaction, raw: true,
    });
    if (existingClaim) return { verified: false, device };
    if (!checkRestrictions) return { verified: true, device };
    if (!device.channel_code || !device.model) return { verified: false, device };

    const [channels, eventModels] = await Promise.all([
        Event_Channels.findAll({ attributes: ["channel_code"], where: { event_id: event.id }, transaction, raw: true }),
        Event_Models.findAll({ attributes: ["eligible_model"], where: { event_id: event.id }, transaction, raw: true }),
    ]);
    return {
        verified: (channels.length === 0 || channels.some((item) => item.channel_code === device.channel_code))
            && (eventModels.length === 0 || eventModels.some((item) => item.eligible_model === device.model)),
        device,
    };
};

module.exports = { getEventDeviceVerification };
