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
