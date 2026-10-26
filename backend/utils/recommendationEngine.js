const EARTH_RADIUS_KM = 6371;

function distanceKm(latitude1, longitude1, latitude2, longitude2) {
    const toRadians = (degrees) => degrees * Math.PI / 180;
    const lat1 = toRadians(latitude1);
    const lat2 = toRadians(latitude2);
    const deltaLatitude = lat2 - lat1;
    const deltaLongitude = toRadians(longitude2 - longitude1);
    const haversine = Math.sin(deltaLatitude / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLongitude / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
}

function priceScore(price, minPrice, maxPrice, maximum) {
    if (maxPrice === minPrice) return maximum;
    return maximum * (maxPrice - price) / (maxPrice - minPrice);
}

function routeScore(ride, route) {
    const hasPickup = Boolean(route.pickup);
    const hasDestination = Boolean(route.destination);
    if (!hasPickup && !hasDestination) return { score: 8, matched: false };
    let score = 0;
    if (hasPickup && ride.pickup.trim().toLowerCase() === route.pickup.toLowerCase()) score += hasDestination ? 8 : 15;
    if (hasDestination && ride.destination.trim().toLowerCase() === route.destination.toLowerCase()) score += hasPickup ? 7 : 15;
    return { score, matched: score > 0 };
}

function scheduleScore(ride, now) {
    const rideDate = new Date(ride.date);
    const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
    const date = new Date(rideDate.toISOString().slice(0, 10) + "T00:00:00.000Z");
    const days = Math.floor((date - today) / 86400000);
    if (days === 0) {
        const [hours, minutes] = ride.time.split(":").map(Number);
        const rideAt = new Date(date.getTime() + (hours * 60 + minutes) * 60000);
        return rideAt > now ? 15 : 2;
    }
    if (days <= 2) return 13;
    if (days <= 7) return 11;
    if (days <= 30) return 8;
    return 5;
}

function vehicleReadiness(vehicle) {
    if (!vehicle) return { score: 8, reason: "No EV profile found; vehicle readiness was not included" };
    let score = vehicle.batteryPercentage < 20 ? 5 : vehicle.batteryPercentage < 50 ? 9 : 12;
    if (vehicle.estimatedRange >= 150) score += 3;
    else if (vehicle.estimatedRange >= 50) score += 2;
    else score += 1;
    if (vehicle.chargingStatus === "fully_charged") score += 1;
    else if (vehicle.chargingStatus === "charging") score += 0.5;
    return {
        score: Math.min(score, 15),
        reason: vehicle.batteryPercentage < 20
            ? "Low vehicle battery detected"
            : vehicle.batteryPercentage >= 50
                ? "Vehicle battery is at a healthy level"
                : "Vehicle battery is below 50%"
    };
}

function rankRides(rides, { vehicle, route = {}, location, nearestStation, availableStationCount = 0, now = new Date() } = {}) {
    if (!rides.length) return [];
    const prices = rides.map((ride) => ride.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return rides.map((ride) => {
        const price = priceScore(ride.price, minPrice, maxPrice, 20);
        const seats = Math.min(ride.availableSeats / 4, 1) * 15;
        const routeResult = routeScore(ride, route);
        const timing = scheduleScore(ride, now);
        const readiness = vehicleReadiness(vehicle);
        const stationScore = nearestStation
            ? nearestStation.distanceKm <= 10 ? 10 : nearestStation.distanceKm <= 50 ? 6 : 2
            : location ? 2 : availableStationCount > 0 ? 7 : 2;
        const status = ride.status === "scheduled" ? 10 : 0;
        const reasons = [];
        if (price >= 14) reasons.push("Low EV fare");
        if (ride.availableSeats > 0) reasons.push("Seats available");
        if (routeResult.matched) reasons.push("Suitable for your selected route");
        else if (!route.pickup && !route.destination) reasons.push("Ride route available");
        if (timing >= 11) reasons.push("Upcoming ride time");
        reasons.push(readiness.reason);
        if (nearestStation && nearestStation.distanceKm <= 10) reasons.push("Nearby charging station");
        else if (nearestStation) reasons.push("Charging station available in the area");
        else if (!location && availableStationCount > 0) reasons.push("Charging stations have available slots");
        else if (!location) reasons.push("Add your location for distance-based station scoring");
        if (vehicle?.chargingStatus === "charging") reasons.push("Your vehicle is currently charging");
        if (vehicle?.chargingStatus === "fully_charged") reasons.push("Your vehicle is fully charged");

        const score = Math.round(price + seats + routeResult.score + timing + readiness.score + stationScore + status);
        return {
            ride: {
                id: ride._id,
                pickup: ride.pickup,
                destination: ride.destination,
                date: ride.date,
                time: ride.time,
                price: ride.price,
                availableSeats: ride.availableSeats,
                status: ride.status
            },
            score: Math.max(0, Math.min(100, score)),
            reasons
        };
    }).sort((a, b) => b.score - a.score || a.ride.price - b.ride.price).slice(0, 10);
}

function rankChargingStations(stations, { vehicle, location, radiusKm = 25 } = {}) {
    if (!stations.length) return [];
    const prices = stations.map((station) => station.chargingPrice);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const lowBattery = Boolean(vehicle && vehicle.batteryPercentage < 20);

    return stations.map((station) => {
        const distance = location
            ? distanceKm(location.latitude, location.longitude, station.latitude, station.longitude)
            : null;
        const statusScore = lowBattery ? 15 : 20;
        const availabilityMaximum = lowBattery ? 30 : 25;
        const availabilityScore = Math.min(station.availableSlots / Math.min(station.totalSlots, 5), 1) * availabilityMaximum;
        const distanceMaximum = lowBattery ? 35 : 25;
        const proximityScore = distance === null
            ? distanceMaximum * 0.5
            : Math.max(0, distanceMaximum * (1 - Math.min(distance, radiusKm) / radiusKm));
        const costMaximum = lowBattery ? 15 : 20;
        const cost = priceScore(station.chargingPrice, minPrice, maxPrice, costMaximum);
        const chargerScore = lowBattery ? (station.chargerType === "fast_charging" ? 5 : station.chargerType === "DC" ? 4 : 3)
            : (station.chargerType === "fast_charging" ? 10 : station.chargerType === "DC" ? 8 : 6);
        const reasons = ["Active charging station", station.availableSlots >= 3 ? "High charging availability" : "Charging slots available"];
        if (distance !== null && distance <= 10) reasons.push("Nearby charging station");
        if (cost >= costMaximum * 0.75) reasons.push("Lower charging cost");
        if (station.chargerType === "fast_charging") reasons.push("Fast charging available");
        if (lowBattery) reasons.push("Low vehicle battery detected");
        if (distance === null) reasons.push("Add your location for distance-based ranking");

        const lowBatteryBoost = lowBattery ? 5 : 0;
        return {
            station: {
                id: station._id,
                name: station.name,
                address: station.address,
                city: station.city,
                state: station.state,
                latitude: station.latitude,
                longitude: station.longitude,
                chargerType: station.chargerType,
                totalSlots: station.totalSlots,
                availableSlots: station.availableSlots,
                chargingPrice: station.chargingPrice,
                status: station.status
            },
            distanceKm: distance === null ? null : Math.round(distance * 100) / 100,
            score: Math.max(0, Math.min(100, Math.round(statusScore + availabilityScore + proximityScore + cost + chargerScore + lowBatteryBoost))),
            reasons
        };
    }).sort((a, b) => b.score - a.score || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.station.chargingPrice - b.station.chargingPrice)
        .slice(0, 10);
}

module.exports = { distanceKm, rankRides, rankChargingStations };
