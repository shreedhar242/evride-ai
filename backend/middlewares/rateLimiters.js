const { rateLimit } = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === "production" ? 10 : 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many authentication attempts. Please try again later." }
});

const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === "production" ? 20 : 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many payment attempts. Please try again later." }
});

module.exports = { authLimiter, paymentLimiter };
