const mongoose = require("mongoose");
const ChargingStation = require("../models/ChargingStation");

const fields = [
    "name", "address", "city", "state", "latitude", "longitude", "chargerType",
    "totalSlots", "availableSlots", "chargingPrice", "status"
];
const chargerTypes = ["AC", "DC", "fast_charging"];
const statuses = ["active", "inactive", "maintenance"];

function validateStation(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return ["Request body must be a JSON object"];
    const errors = [];
    const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
    const required = ["name", "address", "city", "state", "latitude", "longitude", "chargerType", "totalSlots", "availableSlots", "chargingPrice"];

    if (!partial) {
        for (const field of required) {
            if (!has(field) || body[field] === "" || body[field] === null || body[field] === undefined) {
                errors.push(`${field} is required`);
            }
        }
    }
    for (const field of ["name", "address", "city", "state"]) {
        if (has(field) && (typeof body[field] !== "string" || !body[field].trim() || body[field].trim().length > 200)) {
            errors.push(`${field} must be a non-empty string of at most 200 characters`);
        }
    }
    if (has("latitude") && (typeof body.latitude !== "number" || !Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90)) {
        errors.push("Latitude must be between -90 and 90");
    }
    if (has("longitude") && (typeof body.longitude !== "number" || !Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180)) {
        errors.push("Longitude must be between -180 and 180");
    }
    if (has("chargerType") && !chargerTypes.includes(body.chargerType)) {
        errors.push(`Charger type must be one of: ${chargerTypes.join(", ")}`);
    }
    if (has("totalSlots") && (!Number.isInteger(body.totalSlots) || body.totalSlots < 1)) {
        errors.push("Total slots must be a positive whole number");
    }
    if (has("availableSlots") && (!Number.isInteger(body.availableSlots) || body.availableSlots < 0)) {
        errors.push("Available slots must be a non-negative whole number");
    }
    if (has("chargingPrice") && (typeof body.chargingPrice !== "number" || !Number.isFinite(body.chargingPrice) || body.chargingPrice < 0)) {
        errors.push("Charging price must be a non-negative number");
    }
    if (has("status") && !statuses.includes(body.status)) {
        errors.push(`Status must be one of: ${statuses.join(", ")}`);
    }
    return errors;
}

function isAvailable(station) {
    return station.status === "active" && station.availableSlots > 0;
}

function stationResponse(station) {
    const result = station.toObject ? station.toObject() : station;
    return { ...result, isAvailable: isAvailable(result) };
}

async function findStation(id, res) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid charging station ID" });
        return null;
    }
    const station = await ChargingStation.findById(id);
    if (!station) {
        res.status(404).json({ success: false, message: "Charging station not found" });
        return null;
    }
    return station;
}

async function findOwnedStation(id, userId, res) {
    const station = await findStation(id, res);
    if (!station) return null;
    if (station.createdBy.toString() !== userId.toString()) {
        res.status(403).json({ success: false, message: "Only the station creator can perform this action" });
        return null;
    }
    return station;
}

exports.createStation = async (req, res) => {
    try {
        const body = req.body || {};
        if (Object.prototype.hasOwnProperty.call(body, "createdBy")) {
            return res.status(400).json({ success: false, message: "createdBy is assigned from the authenticated user" });
        }
        const unknown = Object.keys(body).filter((field) => !fields.includes(field));
        const errors = validateStation(body);
        if (unknown.length) errors.push(`Unsupported fields: ${unknown.join(", ")}`);
        if (errors.length) return res.status(400).json({ success: false, message: errors.join("; ") });

        const station = await ChargingStation.create({ ...body, createdBy: req.user._id });
        return res.status(201).json({ success: true, station: stationResponse(station) });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: "Charging station contains invalid field values" });
        }
        console.error("Create charging station failed.");
        return res.status(500).json({ success: false, message: "Unable to create charging station" });
    }
};

exports.getStations = async (_req, res) => {
    try {
        const stations = await ChargingStation.find({ status: "active" }).sort({ createdAt: -1 });
        return res.json({ success: true, count: stations.length, stations: stations.map(stationResponse) });
    } catch (error) {
        console.error("Get charging stations failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve charging stations" });
    }
};

exports.getNearbyStations = async (req, res) => {
    const { latitude: rawLatitude, longitude: rawLongitude, radius: rawRadius } = req.query;
    if (typeof rawLatitude !== "string" || !rawLatitude.trim() ||
        typeof rawLongitude !== "string" || !rawLongitude.trim() ||
        (rawRadius !== undefined && (typeof rawRadius !== "string" || !rawRadius.trim()))) {
        return res.status(400).json({ success: false, message: "Valid latitude, longitude, and radius (0 to 500 km) are required" });
    }
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    const radius = rawRadius === undefined ? 10 : Number(rawRadius);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isFinite(radius) || radius <= 0 || radius > 500) {
        return res.status(400).json({ success: false, message: "Valid latitude, longitude, and radius (0 to 500 km) are required" });
    }

    try {
        const stations = await ChargingStation.find({ status: "active" });
        const nearby = stations.map((station) => {
            const lat1 = latitude * Math.PI / 180;
            const lat2 = station.latitude * Math.PI / 180;
            const deltaLat = lat2 - lat1;
            const deltaLon = (station.longitude - longitude) * Math.PI / 180;
            const haversine = Math.sin(deltaLat / 2) ** 2 +
                Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
            const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
            return { station: stationResponse(station), distanceKm: Math.round(distanceKm * 100) / 100 };
        }).filter((item) => item.distanceKm <= radius)
            .sort((a, b) => a.distanceKm - b.distanceKm);

        return res.json({ success: true, count: nearby.length, stations: nearby });
    } catch (error) {
        console.error("Find nearby charging stations failed.");
        return res.status(500).json({ success: false, message: "Unable to find nearby charging stations" });
    }
};

exports.getStation = async (req, res) => {
    try {
        const station = await findStation(req.params.id, res);
        if (!station) return;
        return res.json({ success: true, station: stationResponse(station) });
    } catch (error) {
        console.error("Get charging station failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve charging station" });
    }
};

exports.getMyStations = async (req, res) => {
    try {
        const stations = await ChargingStation.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
        return res.json({ success: true, count: stations.length, stations: stations.map(stationResponse) });
    } catch (error) {
        console.error("Get my charging stations failed.");
        return res.status(500).json({ success: false, message: "Unable to retrieve your charging stations" });
    }
};

exports.updateStation = async (req, res) => {
    try {
        const body = req.body || {};
        const unknown = Object.keys(body).filter((field) => !fields.includes(field));
        if (Object.prototype.hasOwnProperty.call(body, "createdBy")) {
            return res.status(400).json({ success: false, message: "createdBy cannot be changed" });
        }
        if (unknown.length) return res.status(400).json({ success: false, message: `Unsupported fields: ${unknown.join(", ")}` });
        if (Object.keys(body).length === 0) return res.status(400).json({ success: false, message: "Provide fields to update" });

        const station = await findOwnedStation(req.params.id, req.user._id, res);
        if (!station) return;
        const errors = validateStation(body, true);
        const nextTotal = Object.prototype.hasOwnProperty.call(body, "totalSlots") ? body.totalSlots : station.totalSlots;
        const nextAvailable = Object.prototype.hasOwnProperty.call(body, "availableSlots") ? body.availableSlots : station.availableSlots;
        if (Number.isInteger(nextTotal) && Number.isInteger(nextAvailable) && nextAvailable > nextTotal) {
            errors.push("Available slots cannot exceed total slots");
        }
        if (errors.length) return res.status(400).json({ success: false, message: errors.join("; ") });

        for (const field of fields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) station[field] = body[field];
        }
        await station.save();
        return res.json({ success: true, station: stationResponse(station) });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: "Charging station contains invalid field values" });
        }
        console.error("Update charging station failed.");
        return res.status(500).json({ success: false, message: "Unable to update charging station" });
    }
};

exports.deleteStation = async (req, res) => {
    try {
        const station = await findOwnedStation(req.params.id, req.user._id, res);
        if (!station) return;
        station.status = "inactive";
        await station.save();
        return res.json({ success: true, message: "Charging station marked inactive", station: stationResponse(station) });
    } catch (error) {
        console.error("Deactivate charging station failed.");
        return res.status(500).json({ success: false, message: "Unable to deactivate charging station" });
    }
};
