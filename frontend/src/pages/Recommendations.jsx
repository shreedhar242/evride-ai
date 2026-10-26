import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatFare(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function chargerLabel(value) {
  return value === "fast_charging" ? "Fast Charging" : value;
}

function buildQuery({ vehicleId, latitude, longitude, radius }) {
  const query = new URLSearchParams();
  if (vehicleId) query.set("vehicleId", vehicleId);
  if (latitude !== "" && longitude !== "") {
    query.set("latitude", latitude);
    query.set("longitude", longitude);
  }
  if (radius !== "") query.set("radius", radius);
  return query.toString();
}

function RideRecommendationCard({ item }) {
  const ride = item.ride;
  return (
    <article className="recommendation-card">
      <div className="recommendation-card-top">
        <span className="recommendation-label"><span aria-hidden="true">✦</span> AI Recommended</span>
        <span className="recommendation-score"><strong>{item.score}</strong><small>/ 100</small></span>
      </div>
      <div className="recommendation-route">
        <div><small>FROM</small><strong>{ride.pickup}</strong></div><span aria-hidden="true">→</span><div><small>TO</small><strong>{ride.destination}</strong></div>
      </div>
      <div className="recommendation-facts">
        <div><small>DATE &amp; TIME</small><strong>{formatDate(ride.date)} · {ride.time}</strong></div>
        <div><small>AVAILABLE SEATS</small><strong>{ride.availableSeats}</strong></div>
        <div><small>EV FARE</small><strong>{formatFare(ride.price)}</strong></div>
        <div><small>STATUS</small><strong className="recommendation-status">{ride.status}</strong></div>
      </div>
      <div className="recommendation-reasons"><h3>Why this ride?</h3><ul>{item.reasons.map((reason, index) => <li key={`${reason}-${index}`}><span aria-hidden="true">✓</span>{reason}</li>)}</ul></div>
      <Link className="recommendation-action" to="/rides">View Ride <span aria-hidden="true">→</span></Link>
    </article>
  );
}

function StationRecommendationCard({ item }) {
  const station = item.station;
  return (
    <article className="recommendation-card station-recommendation-card">
      <div className="recommendation-card-top">
        <span className="recommendation-label station-recommendation-label"><span aria-hidden="true">ϟ</span> AI Recommended Charging Station</span>
        <span className="recommendation-score"><strong>{item.score}</strong><small>/ 100</small></span>
      </div>
      <h3 className="recommended-station-name">{station.name}</h3>
      <p className="recommended-station-location">{station.address}, {station.city}, {station.state}</p>
      <div className="recommendation-facts">
        <div><small>CHARGER</small><strong>{chargerLabel(station.chargerType)}</strong></div>
        <div><small>AVAILABLE SLOTS</small><strong>{station.availableSlots} / {station.totalSlots}</strong></div>
        <div><small>CHARGING PRICE</small><strong>{formatFare(station.chargingPrice)} / unit</strong></div>
        <div><small>STATUS</small><strong className="recommendation-status">{station.status}</strong></div>
        {item.distanceKm !== null && item.distanceKm !== undefined && <div><small>DISTANCE</small><strong>{item.distanceKm} km</strong></div>}
      </div>
      <div className="recommendation-reasons"><h3>Why this station?</h3><ul>{item.reasons.map((reason, index) => <li key={`${reason}-${index}`}><span aria-hidden="true">✓</span>{reason}</li>)}</ul></div>
      <Link className="recommendation-action" to="/charging-stations">View Charging Stations <span aria-hidden="true">→</span></Link>
    </article>
  );
}

export default function Recommendations() {
  const [rides, setRides] = useState([]);
  const [stations, setStations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [vehicleError, setVehicleError] = useState(false);
  const [location, setLocation] = useState({ latitude: "", longitude: "", radius: "" });
  const [locationError, setLocationError] = useState("");
  const [rideLoading, setRideLoading] = useState(true);
  const [stationLoading, setStationLoading] = useState(true);
  const [rideError, setRideError] = useState(false);
  const [stationError, setStationError] = useState(false);

  async function fetchRideRecommendations(query) {
    setRideLoading(true);
    setRideError(false);
    try {
      const suffix = query ? `?${query}` : "";
      const { data } = await api.get(`/recommendations/rides${suffix}`);
      setRides(Array.isArray(data.recommendations) ? data.recommendations : []);
    } catch (_requestError) {
      setRideError(true);
      setRides([]);
    } finally {
      setRideLoading(false);
    }
  }

  async function fetchStationRecommendations(query) {
    setStationLoading(true);
    setStationError(false);
    try {
      const suffix = query ? `?${query}` : "";
      const { data } = await api.get(`/recommendations/charging-stations${suffix}`);
      setStations(Array.isArray(data.recommendations) ? data.recommendations : []);
    } catch (_requestError) {
      setStationError(true);
      setStations([]);
    } finally {
      setStationLoading(false);
    }
  }

  async function loadVehicles() {
    setVehicleLoading(true);
    setVehicleError(false);
    try {
      const { data } = await api.get("/vehicles/my");
      const list = Array.isArray(data.vehicles) ? data.vehicles : [];
      setVehicles(list);
      return list;
    } catch (_requestError) {
      setVehicleError(true);
      setVehicles([]);
      return [];
    } finally {
      setVehicleLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      const list = await loadVehicles();
      if (!active) return;
      const firstId = list[0]?._id || "";
      setSelectedVehicleId(firstId);
      const query = buildQuery({ vehicleId: firstId, latitude: "", longitude: "", radius: "" });
      await Promise.all([fetchRideRecommendations(query), fetchStationRecommendations(query)]);
    }
    initialize();
    return () => { active = false; };
  }, []);

  function validateLocation() {
    const hasLatitude = location.latitude.trim() !== "";
    const hasLongitude = location.longitude.trim() !== "";
    if (hasLatitude !== hasLongitude) return "Enter both latitude and longitude, or leave both blank.";
    if (hasLatitude) {
      const latitude = Number(location.latitude);
      const longitude = Number(location.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return "Enter a valid latitude (−90 to 90) and longitude (−180 to 180).";
      }
    }
    if (location.radius.trim() !== "") {
      const radius = Number(location.radius);
      if (!Number.isFinite(radius) || radius <= 0 || radius > 500) return "Radius must be greater than 0 and no more than 500 km.";
    }
    return "";
  }

  async function updateRecommendations(event) {
    event.preventDefault();
    const error = validateLocation();
    setLocationError(error);
    if (error) return;
    const query = buildQuery({ vehicleId: selectedVehicleId, ...location });
    await Promise.all([fetchRideRecommendations(query), fetchStationRecommendations(query)]);
  }

  function clearLocation() {
    const cleared = { latitude: "", longitude: "", radius: "" };
    setLocation(cleared);
    setLocationError("");
    const query = buildQuery({ vehicleId: selectedVehicleId, ...cleared });
    Promise.all([fetchRideRecommendations(query), fetchStationRecommendations(query)]);
  }

  function updateLocation(event) {
    setLocation((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateVehicle(event) {
    setSelectedVehicleId(event.target.value);
  }

  function refreshRides() {
    const query = buildQuery({ vehicleId: selectedVehicleId, ...location });
    fetchRideRecommendations(query);
  }

  function refreshStations() {
    const query = buildQuery({ vehicleId: selectedVehicleId, ...location });
    fetchStationRecommendations(query);
  }

  return (
    <div className="recommendations-page">
      <section className="recommendations-hero">
        <div><span className="eyebrow eyebrow-dark"><span className="live-dot" /> RULE-BASED EV INSIGHTS</span><h1>Your next move,<br /><span>made clearer.</span></h1><p>Personalized ride and charging suggestions based on your EV profile and preferences.</p></div>
        <div className="recommendations-hero-mark" aria-hidden="true">✦<small>SMART<br />TRAVEL</small></div>
      </section>

      <section className="recommendation-controls" aria-labelledby="recommendation-controls-title">
        <div className="recommendation-controls-heading"><div><span className="eyebrow eyebrow-dark">PERSONALIZE YOUR RESULTS</span><h2 id="recommendation-controls-title">Recommendation preferences</h2></div></div>
        <form className="recommendation-controls-form" onSubmit={updateRecommendations}>
          <label className="recommendation-field vehicle-select-field"><span>Select EV Vehicle</span><select value={selectedVehicleId} onChange={updateVehicle} disabled={vehicleLoading || vehicles.length === 0}><option value="">No vehicle selected</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.make} {vehicle.model} · {vehicle.registrationNumber}</option>)}</select></label>
          <label className="recommendation-field"><span>Latitude (optional)</span><input name="latitude" type="number" min="-90" max="90" step="any" value={location.latitude} onChange={updateLocation} placeholder="12.9716" /></label>
          <label className="recommendation-field"><span>Longitude (optional)</span><input name="longitude" type="number" min="-180" max="180" step="any" value={location.longitude} onChange={updateLocation} placeholder="77.5946" /></label>
          <label className="recommendation-field"><span>Radius km (optional)</span><input name="radius" type="number" min="0.01" max="500" step="any" value={location.radius} onChange={updateLocation} placeholder="25 default" /></label>
          <div className="recommendation-control-actions"><button className="ride-search-button" type="submit" disabled={rideLoading || stationLoading}>Update recommendations</button><button className="ride-reset-button" type="button" onClick={clearLocation}>Clear Location</button></div>
        </form>
        {locationError && <p className="recommendation-inline-error" role="alert">{locationError}</p>}
        {vehicleError && <p className="recommendation-inline-error" role="alert">Your vehicles couldn't be loaded. Recommendations can still be viewed without a vehicle profile. <button type="button" onClick={loadVehicles}>Retry vehicles</button></p>}
        {!vehicleLoading && !vehicleError && vehicles.length === 0 && <p className="recommendation-vehicle-hint">Add an EV vehicle to get vehicle-aware charging recommendations. <Link to="/vehicles">My Vehicles</Link></p>}
      </section>

      <section className="recommendation-section" aria-labelledby="recommended-rides-title">
        <div className="recommendation-section-heading"><div><span className="eyebrow eyebrow-dark">RANKED FOR YOUR JOURNEY</span><h2 id="recommended-rides-title">Recommended EV Rides</h2></div></div>
        {rideLoading && <div className="rides-loading"><span className="loading-spinner" />Finding recommended EV rides...</div>}
        {rideError && <div className="rides-message rides-error"><span className="message-mark" aria-hidden="true">!</span><h3>Ride recommendations are unavailable.</h3><p>Please try again in a moment.</p><button className="ride-search-button" type="button" onClick={refreshRides}>Retry</button></div>}
        {!rideLoading && !rideError && rides.length === 0 && <div className="rides-message rides-empty"><span className="message-mark" aria-hidden="true">✦</span><h3>No ride recommendations available right now.</h3><p>Browse all scheduled rides to find a route that suits you.</p><Link className="ride-search-button recommendation-empty-link" to="/rides">Find EV Rides</Link></div>}
        {!rideLoading && !rideError && rides.length > 0 && <div className="recommendations-grid">{rides.map((item) => <RideRecommendationCard key={item.ride.id} item={item} />)}</div>}
      </section>

      <section className="recommendation-section" aria-labelledby="recommended-stations-title">
        <div className="recommendation-section-heading"><div><span className="eyebrow eyebrow-dark">CHARGE WITH CONFIDENCE</span><h2 id="recommended-stations-title">Recommended Charging Stations</h2></div></div>
        {stationLoading && <div className="rides-loading"><span className="loading-spinner" />Finding recommended charging stations...</div>}
        {stationError && <div className="rides-message rides-error"><span className="message-mark" aria-hidden="true">!</span><h3>Charging recommendations are unavailable.</h3><p>Please try again in a moment.</p><button className="ride-search-button" type="button" onClick={refreshStations}>Retry</button></div>}
        {!stationLoading && !stationError && stations.length === 0 && <div className="rides-message rides-empty"><span className="message-mark" aria-hidden="true">ϟ</span><h3>No charging station recommendations available right now.</h3><p>Browse charging stations to see active locations.</p><Link className="ride-search-button recommendation-empty-link" to="/charging-stations">View Charging Stations</Link></div>}
        {!stationLoading && !stationError && stations.length > 0 && <div className="recommendations-grid">{stations.map((item) => <StationRecommendationCard key={item.station.id} item={item} />)}</div>}
      </section>
    </div>
  );
}
