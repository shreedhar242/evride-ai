const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const { calculateEVFare, EV_DISCOUNT_PERCENTAGE } = require("../utils/evPricing");

const rideFields = ["vehicle", "pickup", "destination", "date", "time", "availableSeats", "comparableFare", "status"];
const vehicleFields = ["make", "model", "number"];
const statuses = ["scheduled", "full", "started", "ongoing", "completed", "cancelled"];
const statusTransitions = {
    scheduled: ["ongoing", "started", "cancelled"],
    full: ["ongoing", "started", "cancelled"],
    started: ["completed", "cancelled"],
    ongoing: ["completed", "cancelled"]
};

function publicRideStatus(ride) {
    if (ride.status === "started") return "ongoing";
    if (ride.status === "scheduled" && ride.availableSeats === 0) return "full";
    return ride.status;
}

function validateRide(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return ["Request body must be a JSON object"];
    const errors = [];
    const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

    if (!partial || has("vehicle")) {
        if (!body.vehicle || typeof body.vehicle !== "object" || Array.isArray(body.vehicle)) {
            errors.push("Vehicle must include make, model, and number");
        } else {
            const unknownVehicleFields = Object.keys(body.vehicle).filter((field) => !vehicleFields.includes(field));
            if (unknownVehicleFields.length) errors.push("Vehicle contains unsupported fields");
            for (const field of vehicleFields) {
                if (typeof body.vehicle[field] !== "string" || !body.vehicle[field].trim() || body.vehicle[field].trim().length > 60) {
                    errors.push(`Vehicle ${field} is required`);
                }
            }
        }
    }
    for (const field of ["pickup", "destination"]) {
        if ((!partial || has(field)) && (typeof body[field] !== "string" || !body[field].trim() || body[field].trim().length > 120)) {
            errors.push(`${field} is required`);
        }
    }
    if (!partial || has("date")) {
        if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
            errors.push("Date must use YYYY-MM-DD format");
        } else {
            const parsed = new Date(`${body.date}T00:00:00.000Z`);
            if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== body.date) {
                errors.push("Date must be a valid calendar date");
            } else if (parsed < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z")) {
                errors.push("Date cannot be in the past");
            }
        }
    }
    if ((!partial || has("time")) && (typeof body.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))) {
        errors.push("Time must use 24-hour HH:mm format");
    }
    if (!partial || has("availableSeats")) {
        if (!Number.isInteger(body.availableSeats) || body.availableSeats < 1) {
            errors.push("Available seats must be a positive whole number");
        }
    }
    if (!partial || has("comparableFare")) {
        if (typeof body.comparableFare !== "number" || !Number.isFinite(body.comparableFare) || body.comparableFare <= 0) {
            errors.push("comparableFare must be a positive number");
        } else {
            try {
                calculateEVFare(body.comparableFare);
            } catch (error) {
                errors.push(error.message);
            }
        }
    }
    if (has("price")) errors.push("Ride price is calculated by the server; send comparableFare instead");
    if (has("status") && !statuses.includes(body.status)) {
        errors.push(`Status must be one of: ${statuses.join(", ")}`);
    }
    return errors;
}

function invalidId(id) {
    return !mongoose.Types.ObjectId.isValid(id);
}

exports.createRide = async (req, res) => {
    try {
        const body = req.body || {};
        const errors = validateRide(body);
        const unknown = Object.keys(body).filter((key) => !rideFields.includes(key) && key !== "price");
        if (unknown.length) errors.push("Ride contains unsupported fields");
        if (body.status !== undefined && body.status !== "scheduled") {
            errors.push("New rides must start with scheduled status");
        }
        if (errors.length) return res.status(400).json({ success: false, message: errors.join("; ") });

        const evFare = calculateEVFare(body.comparableFare);
        const ride = await Ride.create({
            ...Object.fromEntries(rideFields.filter((field) => field in body).map((field) => [field, body[field]])),
            price: evFare,
            discountPercentage: EV_DISCOUNT_PERCENTAGE,
            driver: req.user._id
        });
        await ride.populate("driver", "name");
        return res.status(201).json({
            success: true,
            ride,
            pricing: {
                comparableFare: ride.comparableFare,
                discountPercentage: ride.discountPercentage,
                evFare: ride.price
            }
        });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: "Ride contains invalid field values" });
        }
        console.error("Create ride failed.");
        return res.status(500).json({ success: false, message: "Unable to create ride" });
    }
};

exports.getRides = async (_req, res) => {
    try {
        const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
        const rides = await Ride.find({ status: "scheduled", availableSeats: { $gt: 0 }, date: { $gte: today } })
            .populate("driver", "name")
            .sort({ date: 1, time: 1 });
        return res.json({ success: true, count: rides.length, rides });
    } catch (error) {
        console.error("Get rides failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve rides" });
    }
};

exports.getRide = async (req, res) => {
    try {
        if (invalidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ride ID" });
        const ride = await Ride.findById(req.params.id).populate("driver", "name");
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        ride.status = publicRideStatus(ride);
        return res.json({ success: true, ride });
    } catch (error) {
        console.error("Get ride failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve ride" });
    }
};

exports.updateRide = async (req, res) => {
    try {
        if (invalidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ride ID" });
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        if (ride.driver.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Only the driver who created this ride can update it" });
        }
        const body = req.body || {};
        const errors = validateRide(body, true);
        const unknown = Object.keys(body).filter((key) => !rideFields.includes(key) && key !== "price");
        if (unknown.length) errors.push("Ride contains unsupported fields");
        if (body.status !== undefined && !(statusTransitions[ride.status] || []).includes(body.status)) {
            errors.push("Ride status can move from scheduled/full to ongoing or cancelled, and from ongoing to completed or cancelled");
        }
        if (errors.length) return res.status(400).json({ success: false, message: errors.join("; ") });

        const previousStatus = ride.status;
        for (const field of rideFields) if (field in body) ride[field] = body[field];
        if (Object.prototype.hasOwnProperty.call(body, "comparableFare")) {
            ride.price = calculateEVFare(body.comparableFare);
            ride.discountPercentage = EV_DISCOUNT_PERCENTAGE;
        }
        if (previousStatus === "full" && ride.availableSeats > 0 && body.status === undefined) {
            ride.status = "scheduled";
        }
        await ride.save();
        await ride.populate("driver", "name");
        return res.json({
            success: true,
            ride,
            ...(ride.comparableFare !== undefined ? {
                pricing: {
                    comparableFare: ride.comparableFare,
                    discountPercentage: ride.discountPercentage,
                    evFare: ride.price
                }
            } : {})
        });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: "Ride contains invalid field values" });
        }
        console.error("Update ride failed.");
        return res.status(500).json({ success: false, message: "Unable to update ride" });
    }
};

exports.getMyRides = async (req, res) => {
    try {
        const rides = await Ride.find({ driver: req.user._id })
            .sort({ date: 1, time: 1 })
            .lean();
        const summaries = rides.length
            ? await Booking.aggregate([
                { $match: { ride: { $in: rides.map((ride) => ride._id) } } },
                {
                    $group: {
                        _id: "$ride",
                        bookingCount: { $sum: 1 },
                        confirmedBookings: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
                        cancelledBookings: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
                        seatsBooked: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, "$seatsBooked", 0] } }
                    }
                }
            ])
            : [];
        const summaryByRide = new Map(summaries.map((summary) => [summary._id.toString(), summary]));
        const result = rides.map((ride) => {
            const summary = summaryByRide.get(ride._id.toString());
            return {
                ...ride,
                status: publicRideStatus(ride),
                bookingSummary: {
                    bookingCount: summary?.bookingCount || 0,
                    confirmedBookings: summary?.confirmedBookings || 0,
                    cancelledBookings: summary?.cancelledBookings || 0,
                    passengerCount: summary?.confirmedBookings || 0,
                    seatsBooked: summary?.seatsBooked || 0
                }
            };
        });
        return res.json({ success: true, count: result.length, rides: result });
    } catch (error) {
        console.error("Get driver rides failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve your rides" });
    }
};

exports.cancelRide = async (req, res) => {
    try {
        if (invalidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ride ID" });
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        if (ride.driver.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Only the driver who created this ride can cancel it" });
        }
        if (["completed", "cancelled"].includes(ride.status)) {
            return res.status(409).json({ success: false, message: "This ride can no longer be cancelled" });
        }
        ride.status = "cancelled";
        await ride.save();
        await ride.populate("driver", "name");
        return res.json({ success: true, message: "Ride cancelled", ride });
    } catch (error) {
        console.error("Cancel ride failed.");
        return res.status(500).json({ success: false, message: "Unable to cancel ride" });
    }
};
