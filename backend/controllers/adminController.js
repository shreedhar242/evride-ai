const mongoose = require("mongoose");
const User = require("../models/User");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Vehicle = require("../models/Vehicle");
const ChargingStation = require("../models/ChargingStation");

function isValidId(id) {
    return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

function safeError(res, message) {
    return res.status(500).json({ success: false, message });
}

exports.getStats = async (_req, res) => {
    try {
        const [totalUsers, totalRiders, totalDrivers, totalRides, totalBookings, totalPayments, successfulPayments, activeChargingStations] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "rider" }),
            User.countDocuments({ role: "driver" }),
            Ride.countDocuments(),
            Booking.countDocuments(),
            Payment.countDocuments(),
            Payment.countDocuments({ status: { $in: ["paid", "captured"] } }),
            ChargingStation.countDocuments({ status: "active" })
        ]);
        return res.json({
            success: true,
            stats: { totalUsers, totalRiders, totalDrivers, totalRides, totalBookings, totalPayments, successfulPayments, activeChargingStations }
        });
    } catch (_error) {
        return safeError(res, "Unable to retrieve platform statistics");
    }
};

exports.getUsers = async (_req, res) => {
    try {
        const users = await User.find()
            .select("_id name email phone role isActive createdAt")
            .sort({ createdAt: -1 });
        return res.json({ success: true, count: users.length, users });
    } catch (_error) {
        return safeError(res, "Unable to retrieve users");
    }
};

exports.getRides = async (_req, res) => {
    try {
        const rides = await Ride.find()
            .populate("driver", "name email role")
            .sort({ createdAt: -1 });
        return res.json({ success: true, count: rides.length, rides });
    } catch (_error) {
        return safeError(res, "Unable to retrieve rides");
    }
};

exports.getBookings = async (_req, res) => {
    try {
        const bookings = await Booking.find()
            .populate("passenger", "name email role")
            .populate({
                path: "ride",
                select: "pickup destination date time price status driver vehicle",
                populate: { path: "driver", select: "name email role" }
            })
            .sort({ createdAt: -1 });
        return res.json({ success: true, count: bookings.length, bookings });
    } catch (_error) {
        return safeError(res, "Unable to retrieve bookings");
    }
};

exports.getPayments = async (_req, res) => {
    try {
        const payments = await Payment.find()
            .select("user booking ride seatsBooked amountPaise currency provider orderId paymentId signatureVerified status refundId refundStatus createdAt")
            .populate("user", "name email role")
            .populate("booking", "seatsBooked totalPrice status createdAt")
            .populate("ride", "pickup destination date time price status")
            .sort({ createdAt: -1 });
        return res.json({ success: true, count: payments.length, payments });
    } catch (_error) {
        return safeError(res, "Unable to retrieve payments");
    }
};

exports.getVehicles = async (_req, res) => {
    try {
        const vehicles = await Vehicle.find()
            .populate("owner", "name email role")
            .sort({ createdAt: -1 });
        return res.json({ success: true, count: vehicles.length, vehicles });
    } catch (_error) {
        return safeError(res, "Unable to retrieve vehicles");
    }
};

exports.getChargingStations = async (_req, res) => {
    try {
        const chargingStations = await ChargingStation.find()
            .populate("createdBy", "name email role")
            .sort({ createdAt: -1 });
        return res.json({ success: true, count: chargingStations.length, chargingStations });
    } catch (_error) {
        return safeError(res, "Unable to retrieve charging stations");
    }
};

exports.updateUserStatus = async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body || {};
    if (!isValidId(id)) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    if (typeof isActive !== "boolean") {
        return res.status(400).json({ success: false, message: "isActive must be true or false" });
    }
    if (!isActive && new mongoose.Types.ObjectId(id).equals(req.user._id)) {
        return res.status(400).json({ success: false, message: "Admins cannot deactivate their own account" });
    }

    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        user.isActive = isActive;
        await user.save();
        return res.json({
            success: true,
            message: `User ${isActive ? "activated" : "deactivated"}`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt
            }
        });
    } catch (_error) {
        return safeError(res, "Unable to update user status");
    }
};
