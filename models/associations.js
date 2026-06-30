const configureAssociations = (models) => {
    const {
        Promotions,
        Events,
        Gifts,
        Channels,
        Devices,
        Promotion_Gifts,
        Promotion_Devices,
        Promotion_Channels,
        Event_Channels,
        Event_Claims,
        Event_Models,
        Event_Form_Sections,
        Event_Form_Custom_Fields,
        Event_Form_Field_Options,
        Event_Form_Uploads,
        Customers,
        Claims,
        Claim_Gifts,
        Deliver_Addresses,
        Deliveries,
        Track_Trace,
    } = models;

    Promotions.hasMany(Promotion_Gifts, {
        foreignKey: "promotion_id",
        sourceKey: "id",
        as: "promotionGifts",
    });
    Promotion_Gifts.belongsTo(Promotions, {
        foreignKey: "promotion_id",
        targetKey: "id",
        as: "promotion",
    });

    Gifts.hasMany(Promotion_Gifts, {
        foreignKey: "gift_id",
        sourceKey: "id",
        as: "promotionGifts",
    });
    Promotion_Gifts.belongsTo(Gifts, {
        foreignKey: "gift_id",
        targetKey: "id",
        as: "gift",
    });

    Promotions.belongsToMany(Gifts, {
        through: Promotion_Gifts,
        foreignKey: "promotion_id",
        otherKey: "gift_id",
        as: "gifts",
    });
    Gifts.belongsToMany(Promotions, {
        through: Promotion_Gifts,
        foreignKey: "gift_id",
        otherKey: "promotion_id",
        as: "promotions",
    });

    Promotions.hasMany(Promotion_Devices, {
        foreignKey: "promotion_id",
        sourceKey: "id",
        as: "promotionDevices",
    });
    Promotion_Devices.belongsTo(Promotions, {
        foreignKey: "promotion_id",
        targetKey: "id",
        as: "promotion",
    });

    Promotions.hasMany(Promotion_Channels, {
        foreignKey: "promotion_id",
        sourceKey: "id",
        as: "promotionChannels",
    });
    Promotion_Channels.belongsTo(Promotions, {
        foreignKey: "promotion_id",
        targetKey: "id",
        as: "promotion",
    });

    Channels.hasMany(Promotion_Channels, {
        foreignKey: "channel_code",
        sourceKey: "code",
        as: "promotionChannels",
    });
    Promotion_Channels.belongsTo(Channels, {
        foreignKey: "channel_code",
        targetKey: "code",
        as: "channel",
    });

    Promotions.belongsToMany(Channels, {
        through: Promotion_Channels,
        foreignKey: "promotion_id",
        otherKey: "channel_code",
        as: "channels",
    });
    Channels.belongsToMany(Promotions, {
        through: Promotion_Channels,
        foreignKey: "channel_code",
        otherKey: "promotion_id",
        as: "promotions",
    });

    Channels.hasMany(Devices, {
        foreignKey: "channel_code",
        sourceKey: "code",
        as: "devices",
    });
    Devices.belongsTo(Channels, {
        foreignKey: "channel_code",
        targetKey: "code",
        as: "channel",
    });

    Events.hasMany(Event_Channels, {
        foreignKey: "event_id",
        sourceKey: "id",
        as: "eventChannels",
    });
    Event_Channels.belongsTo(Events, {
        foreignKey: "event_id",
        targetKey: "id",
        as: "event",
    });

    Channels.hasMany(Event_Channels, {
        foreignKey: "channel_code",
        sourceKey: "code",
        as: "eventChannels",
    });
    Event_Channels.belongsTo(Channels, {
        foreignKey: "channel_code",
        targetKey: "code",
        as: "channel",
    });

    Events.belongsToMany(Channels, {
        through: Event_Channels,
        foreignKey: "event_id",
        otherKey: "channel_code",
        as: "channels",
    });
    Channels.belongsToMany(Events, {
        through: Event_Channels,
        foreignKey: "channel_code",
        otherKey: "event_id",
        as: "events",
    });

    Events.hasMany(Event_Models, {
        foreignKey: "event_id",
        sourceKey: "id",
        as: "eventModels",
    });
    Event_Models.belongsTo(Events, {
        foreignKey: "event_id",
        targetKey: "id",
        as: "event",
    });

    Events.hasMany(Event_Claims, {
        foreignKey: "event_id",
        sourceKey: "id",
        as: "eventClaims",
    });
    Event_Claims.belongsTo(Events, {
        foreignKey: "event_id",
        targetKey: "id",
        as: "event",
    });

    Events.hasMany(Event_Form_Sections, {
        foreignKey: "event_id",
        sourceKey: "id",
        as: "formSections",
    });
    Event_Form_Sections.belongsTo(Events, {
        foreignKey: "event_id",
        targetKey: "id",
        as: "event",
    });

    Event_Form_Sections.hasMany(Event_Form_Custom_Fields, {
        foreignKey: "section_id",
        sourceKey: "id",
        as: "customFields",
    });
    Event_Form_Custom_Fields.belongsTo(Event_Form_Sections, {
        foreignKey: "section_id",
        targetKey: "id",
        as: "section",
    });

    Event_Form_Custom_Fields.hasMany(Event_Form_Field_Options, {
        foreignKey: "field_id",
        sourceKey: "id",
        as: "options",
    });
    Event_Form_Field_Options.belongsTo(Event_Form_Custom_Fields, {
        foreignKey: "field_id",
        targetKey: "id",
        as: "field",
    });

    Events.hasMany(Event_Form_Uploads, {
        foreignKey: "event_id",
        sourceKey: "id",
        as: "formUploads",
    });
    Event_Form_Uploads.belongsTo(Events, {
        foreignKey: "event_id",
        targetKey: "id",
        as: "event",
    });

    Customers.hasMany(Claims, {
        foreignKey: "customer_id",
        sourceKey: "id",
        as: "claims",
    });
    Claims.belongsTo(Customers, {
        foreignKey: "customer_id",
        targetKey: "id",
        as: "customer",
    });

    Customers.hasMany(Event_Claims, {
        foreignKey: "customer_id",
        sourceKey: "id",
        as: "eventClaims",
    });
    Event_Claims.belongsTo(Customers, {
        foreignKey: "customer_id",
        targetKey: "id",
        as: "customer",
    });

    Devices.hasMany(Claims, {
        foreignKey: "imei",
        sourceKey: "imei",
        as: "claims",
    });
    Claims.belongsTo(Devices, {
        foreignKey: "imei",
        targetKey: "imei",
        as: "device",
    });

    Devices.hasMany(Event_Claims, {
        foreignKey: "imei",
        sourceKey: "imei",
        as: "eventClaims",
    });
    Event_Claims.belongsTo(Devices, {
        foreignKey: "imei",
        targetKey: "imei",
        as: "device",
    });

    Promotions.hasMany(Claims, {
        foreignKey: "promotion_id",
        sourceKey: "id",
        as: "claims",
    });
    Claims.belongsTo(Promotions, {
        foreignKey: "promotion_id",
        targetKey: "id",
        as: "promotion",
    });

    Claims.hasMany(Claim_Gifts, {
        foreignKey: "claim_id",
        sourceKey: "id",
        as: "claimGifts",
    });
    Claim_Gifts.belongsTo(Claims, {
        foreignKey: "claim_id",
        targetKey: "id",
        as: "claim",
    });

    Gifts.hasMany(Claim_Gifts, {
        foreignKey: "gift_id",
        sourceKey: "id",
        as: "claimGifts",
    });
    Claim_Gifts.belongsTo(Gifts, {
        foreignKey: "gift_id",
        targetKey: "id",
        as: "gift",
    });

    Claims.belongsToMany(Gifts, {
        through: Claim_Gifts,
        foreignKey: "claim_id",
        otherKey: "gift_id",
        as: "gifts",
    });
    Gifts.belongsToMany(Claims, {
        through: Claim_Gifts,
        foreignKey: "gift_id",
        otherKey: "claim_id",
        as: "claims",
    });

    Claims.hasMany(Deliver_Addresses, {
        foreignKey: "claim_id",
        sourceKey: "id",
        as: "deliverAddresses",
    });
    Deliver_Addresses.belongsTo(Claims, {
        foreignKey: "claim_id",
        targetKey: "id",
        as: "claim",
    });

    Claims.hasMany(Deliveries, {
        foreignKey: "claim_id",
        sourceKey: "id",
        as: "deliveries",
    });
    Deliveries.belongsTo(Claims, {
        foreignKey: "claim_id",
        targetKey: "id",
        as: "claim",
    });

    Deliver_Addresses.hasMany(Track_Trace, {
        foreignKey: "address_id",
        sourceKey: "id",
        as: "trackTraces",
    });
    Track_Trace.belongsTo(Deliver_Addresses, {
        foreignKey: "address_id",
        targetKey: "id",
        as: "deliveryAddress",
    });
};

module.exports = configureAssociations;
