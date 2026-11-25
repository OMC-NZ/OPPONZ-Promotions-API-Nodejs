const buildPromotionGiftResponseMap = ({ gifts, promotionGifts }) => {
    const giftsById = new Map(gifts.map((gift) => [String(gift.id), gift]));
    const responsesByPromotion = new Map();

    for (const link of promotionGifts) {
        const gift = giftsById.get(String(link.gift_id));
        if (!gift) continue;

        const promotionId = String(link.promotion_id);
        if (!responsesByPromotion.has(promotionId)) responsesByPromotion.set(promotionId, []);
        responsesByPromotion.get(promotionId).push({
            name: gift.name,
            alias: gift.alias,
            color: gift.color,
            status: gift.status,
            gift_comb: link.gift_comb,
        });
    }

    return responsesByPromotion;
};

module.exports = { buildPromotionGiftResponseMap };
