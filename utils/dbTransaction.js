const rollbackTransaction = async (transaction) => {
    if (!transaction || transaction.finished) return;
    try {
        await transaction.rollback();
    } catch (error) {
        console.error("Failed to roll back database transaction:", error.message);
    }
};

module.exports = { rollbackTransaction };
