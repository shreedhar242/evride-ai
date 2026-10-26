function dateOnly(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export function filterAvailableRides(rides, filters = {}) {
  const pickup = String(filters.pickup || "").trim().toLowerCase();
  const destination = String(filters.destination || "").trim().toLowerCase();
  return rides.filter((ride) => {
    if (ride.status !== "scheduled" || Number(ride.availableSeats) <= 0) return false;
    if (pickup && !String(ride.pickup || "").toLowerCase().includes(pickup)) return false;
    if (destination && !String(ride.destination || "").toLowerCase().includes(destination)) return false;
    if (filters.date && dateOnly(ride.date) !== filters.date) return false;
    return true;
  });
}

export function rideDateValue(value) {
  return dateOnly(value);
}
