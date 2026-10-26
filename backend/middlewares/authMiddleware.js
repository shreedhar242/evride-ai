const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

module.exports = async function authMiddleware(req, res, next) {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authorization token is required" });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ success: false, message: "Authentication is not configured" });
    }

    try {
        const token = authorization.slice(7);
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (!payload?.id || !mongoose.Types.ObjectId.isValid(payload.id)) {
            return res.status(401).json({ success: false, message: "Invalid or expired token" });
        }
        const user = await User.findById(payload.id);
        if (!user) {
            return res.status(401).json({ success: false, message: "User for this token was not found" });
        }
        if (user.isActive === false) {
            return res.status(403).json({ success: false, message: "This account is deactivated" });
        }
        req.user = user;
        return next();
    } catch (_error) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};
