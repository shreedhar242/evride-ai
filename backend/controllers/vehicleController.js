const mongoose = require("mongoose");
const Vehicle = require("../models/Vehicle");

const allowedFields = ["make", "model", "year", "registrationNumber", "batteryCapacity", "batteryPercentage", "estimatedRange", "chargingStatus"];
const updateFields = ["batteryPercentage", "estimatedRange", "chargingStatus", "model", "year"];
const chargingStatuses = ["not_charging", "charging", "fully_charged"];
const currentYear = new Date().getFullYear();

function validateVehicle(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return ["Request body must be a JSON object"];
    const errors = [];
    const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
    const requiredFields = ["make", "model", "year", "registrationNumber", "batteryCapacity", "batteryPercentage", "estimatedRange"];

    if (!partial) {
        for (const field of requiredFields) {
            if (!has(field) || body[field] === "" || body[field] === null || body[field] === undefined) {
                errors.push(`${field} is required`);
            }
        }
    }

    for (const field of ["make", "model"]) {
        if (has(field) && (typeof body[field] !== "string" || !body[field].trim() || body[field].trim().length > 100)) {
            errors.push(`${field} must be a non-empty string of at most 100 characters`);
        }
    }
    if (has("year") && (!Number.isInteger(body.year) || body.year < 1886 || body.year > currentYear + 1)) {
        errors.push(`Year must be a whole number between 1886 and ${currentYear + 1}`);
    }
    if (has("registrationNumber") && (typeof body.registrationNumber !== "string" || !/^[A-Za-z0-9 -]{4,15}$/.test(body.registrationNumber.trim()))) {
        errors.push("Registration number must be 4 to 15 letters, numbers, spaces, or hyphens");
    }
    if (has("batteryCapacity") && (typeof body.batteryCapacity !== "number" || !Number.isFinite(body.batteryCapacity) || body.batteryCapacity <= 0)) {
        errors.push("Battery capacity must be a positive number");
    }
    if (has("batteryPercentage") && (typeof body.batteryPercentage !== "number" || !Number.isFinite(body.batteryPercentage) || body.batteryPercentage < 0 || body.batteryPercentage > 100)) {
        errors.push("Battery percentage must be between 0 and 100");
    }
    if (has("estimatedRange") && (typeof body.estimatedRange !== "number" || !Number.isFinite(body.estimatedRange) || body.estimatedRange < 0)) {
        errors.push("Estimated range must be a non-negative number");
    }
    if (has("chargingStatus") && !chargingStatuses.includes(body.chargingStatus)) {
        errors.push(`Charging status must be one of: ${chargingStatuses.join(", ")}`);
    }
    return errors;
}

function validId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

async function findOwnedVehicle(id, userId, res) {
    if (!validId(id)) {
        res.status(400).json({ success: false, message: "Invalid vehicle ID" });
        return null;
    }
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
        res.status(404).json({ success: false, message: "Vehicle not found" });
        return null;
    }
    if (vehicle.owner.toString() !== userId.toString()) {
        res.status(403).json({ success: false, message: "You are not allowed to access this vehicle" });
        return null;
    }
    return vehicle;
}

exports.createVehicle = async (req, res) => {
    try {
        const body = req.body || {};
        if (Object.prototype.hasOwnProperty.call(body, "owner")) {
            return res.status(400).json({ success: false, message: "Owner is assigned from the authenticated user" });
        }
        const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));
        const errors = validateVehicle(body);
        if (unknownFields.length) errors.push(`Unsupported fields: ${unknownFields.join(", ")}`);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join("; ") });

        const vehicle = await Vehicle.create({ ...body, owner: req.user._id });
        return res.status(201).json({ success: true, vehicle });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: "Registration number is already in use" });
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: "Vehicle contains invalid field values" });
        }
        console.error("Create vehicle failed.");
        return res.status(500).json({ success: false, message: "Unable to create vehicle" });
    }
};

exports.getMyVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ owner: req.user._id }).sort({ createdAt: -1 });
        return res.json({ success: true, count: vehicles.length, vehicles });
    } catch (error) {
        console.error("Get vehicles failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve vehicles" });
    }
};

exports.getVehicle = async (req, res) => {
    try {
        const vehicle = await findOwnedVehicle(req.params.id, req.user._id, res);
        if (!vehicle) return;
        return res.json({ success: true, vehicle });
    } catch (error) {
        console.error("Get vehicle failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve vehicle" });
    }
};

exports.updateVehicle = async (req, res) => {
    try {
        const body = req.body || {};
        const unknownFields = Object.keys(body).filter((field) => !updateFields.includes(field));
        if (unknownFields.length) {
            return res.status(400).json({ success: false, message: `Fields cannot be updated: ${unknownFields.join(", ")}` });
        }
        if (Object.keys(body).length === 0) {
            return res.status(400).json({ success: false, message: "Provide at least one supported field to update" });
        }
        const errors = validateVehicle(body, true);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join("; ") });

        const vehicle = await findOwnedVehicle(req.params.id, req.user._id, res);
        if (!vehicle) return;
        for (const field of updateFields) if (Object.prototype.hasOwnProperty.call(body, field)) vehicle[field] = body[field];
        await vehicle.save();
        return res.json({ success: true, vehicle });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: "Vehicle contains invalid field values" });
        }
        console.error("Update vehicle failed.");
        return res.status(500).json({ success: false, message: "Unable to update vehicle" });
    }
};

exports.deleteVehicle = async (req, res) => {
    try {
        const vehicle = await findOwnedVehicle(req.params.id, req.user._id, res);
        if (!vehicle) return;
        await vehicle.deleteOne();
        return res.json({ success: true, message: "Vehicle deleted" });
    } catch (error) {
        console.error("Delete vehicle failed.");
        return res.status(500).json({ success: false, message: "Unable to delete vehicle" });
    }
};
