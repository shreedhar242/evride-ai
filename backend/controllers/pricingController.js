const { calculateEVFare, EV_DISCOUNT_PERCENTAGE } = require("../utils/evPricing");

exports.calculateEVFare = (req, res) => {
    const { comparableFare } = req.body || {};
    if (typeof comparableFare !== "number" || !Number.isFinite(comparableFare) || comparableFare <= 0) {
        return res.status(400).json({ success: false, message: "comparableFare must be a positive number" });
    }

    try {
        const evFare = calculateEVFare(comparableFare);
        return res.json({
            success: true,
            comparableFare,
            discountPercentage: EV_DISCOUNT_PERCENTAGE,
            evFare
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
