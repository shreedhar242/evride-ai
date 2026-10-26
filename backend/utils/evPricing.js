const EV_DISCOUNT_PERCENTAGE = 15;

function calculateEVFare(comparableFare) {
    if (typeof comparableFare !== "number" || !Number.isFinite(comparableFare) || comparableFare <= 0) {
        throw new RangeError("Comparable fare must be a positive number");
    }
    if (!Number.isFinite(EV_DISCOUNT_PERCENTAGE) || EV_DISCOUNT_PERCENTAGE < 0 || EV_DISCOUNT_PERCENTAGE > 100) {
        throw new RangeError("EV discount must be between 0 and 100 percent");
    }

    const evFare = Math.round(comparableFare * (1 - EV_DISCOUNT_PERCENTAGE / 100));
    if (evFare <= 0) {
        throw new RangeError("Calculated EV fare must be greater than zero");
    }
    return evFare;
}

module.exports = { calculateEVFare, EV_DISCOUNT_PERCENTAGE };
