const configureAssociations = (models) => {
    const {
        Promotions,
        Gifts,
        Channels,
        Devices,
        Promotion_Gifts,
        Promotion_Devices,
        Promotion_Channels,
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
};

module.exports = configureAssociations;
