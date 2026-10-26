const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");
const ChargingStation = require("../models/ChargingStation");
const { distanceKm, rankRides, rankChargingStations } = require("../utils/recommendationEngine");

function parseLocation(query, defaultRadius = 25) {
    const hasLatitude = query.latitude !== undefined;
    const hasLongitude = query.longitude !== undefined;
    if (!hasLatitude && !hasLongitude) {
        if (query.radius !== undefined) {
            const radiusKm = Number(query.radius);
            if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
                return { error: "Radius must be between 0 and 500 km" };
            }
            return { location: null, radiusKm };
        }
        return { location: null, radiusKm: defaultRadius };
    }
    if (!hasLatitude || !hasLongitude || typeof query.latitude !== "string" || !query.latitude.trim() ||
        typeof query.longitude !== "string" || !query.longitude.trim()) {
        return { error: "Provide both latitude and longitude as numbers" };
    }
    const latitude = Number(query.latitude);
    const longitude = Number(query.longitude);
    const radiusKm = query.radius === undefined ? defaultRadius : Number(query.radius);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
        return { error: "Coordinates must be valid and radius must be between 0 and 500 km" };
    }
    return { location: { latitude, longitude }, radiusKm };
}

async function getVehicle(req, res) {
    const { vehicleId } = req.query;
    if (vehicleId !== undefined) {
        if (typeof vehicleId !== "string" || !mongoose.Types.ObjectId.isValid(vehicleId)) {
            res.status(400).json({ success: false, message: "Invalid vehicleId" });
            return undefined;
        }
        const selectedVehicle = await Vehicle.findOne({ _id: vehicleId, owner: req.user._id }).lean();
        if (!selectedVehicle) {
            res.status(404).json({ success: false, message: "Vehicle was not found for this user" });
            return undefined;
        }
        return selectedVehicle;
    }
    return Vehicle.findOne({ owner: req.user._id }).sort({ createdAt: -1 }).lean();
}

exports.getRideRecommendations = async (req, res) => {
    try {
        const route = {};
        for (const field of ["pickup", "destination"]) {
            if (req.query[field] !== undefined) {
                if (typeof req.query[field] !== "string" || !req.query[field].trim() || req.query[field].length > 100) {
                    return res.status(400).json({ success: false, message: `${field} must be a non-empty string up to 100 characters` });
                }
                route[field] = req.query[field].trim();
            }
        }
        const parsed = parseLocation(req.query);
        if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

        const vehicle = await getVehicle(req, res);
        if (res.headersSent) return;
        const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
        const [rides, nearbyStations] = await Promise.all([
            Ride.find({ status: "scheduled", availableSeats: { $gt: 0 }, date: { $gte: today }, driver: { $ne: req.user._id } })
                .sort({ date: 1, time: 1 }).limit(50).lean(),
            ChargingStation.find({ status: "active", availableSlots: { $gt: 0 } })
                .select("latitude longitude availableSlots").limit(100).lean()
        ]);

        const bookings = rides.length
            ? await Booking.find({ passenger: req.user._id, status: "confirmed", ride: { $in: rides.map((ride) => ride._id) } })
                .select("ride").lean()
            : [];
        const bookedRideIds = new Set(bookings.map((booking) => booking.ride.toString()));
        const candidates = rides.filter((ride) => !bookedRideIds.has(ride._id.toString()));
        let nearestStation;
        if (parsed.location && nearbyStations.length) {
            const closest = nearbyStations.reduce((best, station) => {
                const distance = distanceKm(parsed.location.latitude, parsed.location.longitude, station.latitude, station.longitude);
                return !best || distance < best.distanceKm ? { distanceKm: distance } : best;
            }, null);
            nearestStation = closest;
        }

        const recommendations = rankRides(candidates, {
            vehicle,
            route,
            location: parsed.location,
            nearestStation,
            availableStationCount: nearbyStations.length
        });
        return res.json({
            success: true,
            count: recommendations.length,
            context: {
                vehicleProfileUsed: Boolean(vehicle),
                locationProvided: Boolean(parsed.location),
                routePreferenceProvided: Boolean(route.pickup || route.destination)
            },
            message: recommendations.length ? undefined : "No available rides match your current preferences",
            recommendations
        });
    } catch (error) {
        console.error("Ride recommendations failed.");
        return res.status(500).json({ success: false, message: "Unable to generate ride recommendations" });
    }
};

exports.getChargingStationRecommendations = async (req, res) => {
    try {
        const parsed = parseLocation(req.query);
        if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
        const vehicle = await getVehicle(req, res);
        if (res.headersSent) return;

        const stations = await ChargingStation.find({ status: "active", availableSlots: { $gt: 0 } })
            .limit(100).lean();
        let candidates = stations;
        if (parsed.location) {
            candidates = stations.filter((station) =>
                distanceKm(parsed.location.latitude, parsed.location.longitude, station.latitude, station.longitude) <= parsed.radiusKm
            );
        }
        const recommendations = rankChargingStations(candidates, {
            vehicle,
            location: parsed.location,
            radiusKm: parsed.radiusKm
        });
        return res.json({
            success: true,
            count: recommendations.length,
            context: {
                vehicleProfileUsed: Boolean(vehicle),
                lowBatteryPriority: Boolean(vehicle && vehicle.batteryPercentage < 20),
                locationProvided: Boolean(parsed.location)
            },
            message: recommendations.length ? undefined : "No available charging stations were found",
            recommendations
        });
    } catch (error) {
        console.error("Charging station recommendations failed.");
        return res.status(500).json({ success: false, message: "Unable to generate charging station recommendations" });
    }
};
