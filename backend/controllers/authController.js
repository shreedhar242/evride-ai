const jwt = require("jsonwebtoken");
const User = require("../models/User");

function publicUser(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt
    };
}

function createToken(user) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body || {};
        if (typeof name !== "string" || !name.trim() ||
            typeof email !== "string" || !email.trim() ||
            typeof password !== "string" || !password) {
            return res.status(400).json({ success: false, message: "Name, email, and password are required" });
        }
        if (name.trim().length > 100 || email.trim().length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 6 || password.length > 128) {
            return res.status(400).json({ success: false, message: "Provide a valid name and email, and a password between 6 and 128 characters" });
        }
        if (phone !== undefined && (typeof phone !== "string" || phone.length > 25)) {
            return res.status(400).json({ success: false, message: "Phone must be a string of 25 characters or fewer" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (await User.exists({ email: normalizedEmail })) {
            return res.status(409).json({ success: false, message: "An account with this email already exists" });
        }

        // Do not let public registration create privileged accounts.
        const user = await User.create({ name, email: normalizedEmail, password, phone, role: "rider" });
        return res.status(201).json({ success: true, user: publicUser(user) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "An account with this email already exists" });
        }
        if (error.name === "ValidationError") {
            return res.status(400).json({ success: false, message: "Registration details are invalid" });
        }
        console.error("Registration failed.");
        return res.status(500).json({ success: false, message: "Unable to register at this time" });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (typeof email !== "string" || !email.trim() ||
            email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            typeof password !== "string" || !password || password.length > 128) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }
        if (user.isActive === false) {
            return res.status(403).json({ success: false, message: "This account is deactivated" });
        }

        return res.json({ success: true, token: createToken(user), user: publicUser(user) });
    } catch (error) {
        console.error("Login failed.");
        return res.status(500).json({ success: false, message: "Unable to log in at this time" });
    }
};

exports.getMe = async (req, res) => {
    return res.json({ success: true, user: publicUser(req.user) });
};
