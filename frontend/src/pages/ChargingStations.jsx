import { useEffect, useState } from "react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const chargerTypes = ["AC", "DC", "fast_charging"];
const stationStatuses = ["active", "inactive", "maintenance"];

function blankForm() {
  return {
    name: "", address: "", city: "", state: "", latitude: "", longitude: "",
    chargerType: "AC", totalSlots: "", availableSlots: "", chargingPrice: "", status: "active"
  };
}

function stationForm(station) {
  return {
    name: station.name,
    address: station.address,
    city: station.city,
    state: station.state,
    latitude: String(station.latitude),
    longitude: String(station.longitude),
    chargerType: station.chargerType,
    totalSlots: String(station.totalSlots),
    availableSlots: String(station.availableSlots),
    chargingPrice: String(station.chargingPrice),
    status: station.status
  };
}

function validateStation(form) {
  const errors = {};
  for (const field of ["name", "address", "city", "state"]) {
    if (!form[field].trim()) errors[field] = "This field is required.";
  }
  const latitude = form.latitude.trim() === "" ? NaN : Number(form.latitude);
  const longitude = form.longitude.trim() === "" ? NaN : Number(form.longitude);
  const totalSlots = form.totalSlots.trim() === "" ? NaN : Number(form.totalSlots);
  const availableSlots = form.availableSlots.trim() === "" ? NaN : Number(form.availableSlots);
  const chargingPrice = form.chargingPrice.trim() === "" ? NaN : Number(form.chargingPrice);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.latitude = "Latitude must be between -90 and 90.";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.longitude = "Longitude must be between -180 and 180.";
  if (!Number.isInteger(totalSlots) || totalSlots < 1) errors.totalSlots = "Enter a positive whole number of total slots.";
  if (!Number.isInteger(availableSlots) || availableSlots < 0) errors.availableSlots = "Available slots must be a non-negative whole number.";
  else if (Number.isInteger(totalSlots) && availableSlots > totalSlots) errors.availableSlots = "Available slots cannot exceed total slots.";
  if (!Number.isFinite(chargingPrice) || chargingPrice < 0) errors.chargingPrice = "Charging price must be zero or more.";
  if (!chargerTypes.includes(form.chargerType)) errors.chargerType = "Choose a valid charger type.";
  if (!stationStatuses.includes(form.status)) errors.status = "Choose a valid station status.";
  return errors;
}

function formPayload(form) {
  return {
    name: form.name.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    chargerType: form.chargerType,
    totalSlots: Number(form.totalSlots),
    availableSlots: Number(form.availableSlots),
    chargingPrice: Number(form.chargingPrice),
    status: form.status
  };
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

function chargerLabel(value) {
  return value === "fast_charging" ? "Fast Charging" : value;
}

function StationCard({ station, isOwner, onDetails, onEdit, onDelete, deleting }) {
  const full = station.status === "active" && station.availableSlots === 0;
  return (
    <article className="station-card">
      <div className="station-card-top">
        <span className="station-kind"><span aria-hidden="true">ϟ</span> EV CHARGING</span>
        <span className={`station-status status-${station.status}`}><span className="station-status-dot" />{station.status}</span>
      </div>
      <h3>{station.name}</h3>
      <p className="station-location">{station.city}, {station.state}</p>
      <p className="station-address">{station.address}</p>
      <div className="station-attributes">
        <div><small>CHARGER</small><strong>{chargerLabel(station.chargerType)}</strong></div>
        <div><small>AVAILABLE SLOTS</small><strong className={full ? "slots-full" : ""}>{full ? "No slots available" : `${station.availableSlots} / ${station.totalSlots} slots`}</strong></div>
        <div><small>CHARGING PRICE</small><strong>{formatPrice(station.chargingPrice)} / unit</strong></div>
        <div><small>COORDINATES</small><strong>{station.latitude}, {station.longitude}</strong></div>
      </div>
      {station.distanceKm !== undefined && <p className="station-distance">{station.distanceKm} km away</p>}
      <div className="station-card-actions">
        <button className="station-details-button" type="button" onClick={() => onDetails(station._id)}>View Details</button>
        {isOwner && <>
          <button className="station-edit-button" type="button" onClick={() => onEdit(station)}>Edit</button>
          {station.status !== "inactive" && <button className="station-delete-button" type="button" disabled={deleting} onClick={() => onDelete(station)}>{deleting ? "Updating…" : "Delete"}</button>}
        </>}
      </div>
    </article>
  );
}

function StationForm({ form, setForm, onSubmit, onClose, busy, error, errors, editing }) {
  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }
  const textFields = [
    ["name", "Station name"], ["address", "Address"], ["city", "City"], ["state", "State"]
  ];
  const numberFields = [
    ["latitude", "Latitude", "any"], ["longitude", "Longitude", "any"],
    ["totalSlots", "Total slots", "1"], ["availableSlots", "Available slots", "1"],
    ["chargingPrice", "Charging price per unit", "any"]
  ];
  return (
    <div className="station-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="station-modal" role="dialog" aria-modal="true" aria-labelledby="station-form-title">
        <button className="station-modal-close" type="button" aria-label="Close station form" disabled={busy} onClick={onClose}>×</button>
        <span className="eyebrow eyebrow-dark">CHARGING NETWORK</span>
        <h2 id="station-form-title">{editing ? "Edit charging station" : "Add charging station"}</h2>
        <p className="station-form-intro">Enter the station information shown to EV drivers.</p>
        {error && <p className="station-form-error" role="alert">{error}</p>}
        <form className="station-form" onSubmit={onSubmit} noValidate>
          {textFields.map(([name, label]) => <label className="station-field" key={name}><span>{label}</span><input name={name} value={form[name]} onChange={update} />{errors[name] && <small>{errors[name]}</small>}</label>)}
          {numberFields.map(([name, label, step]) => <label className="station-field" key={name}><span>{label}</span><input name={name} type="number" step={step} min={name === "totalSlots" ? 1 : undefined} value={form[name]} onChange={update} />{errors[name] && <small>{errors[name]}</small>}</label>)}
          <label className="station-field"><span>Charger type</span><select name="chargerType" value={form.chargerType} onChange={update}><option value="AC">AC</option><option value="DC">DC</option><option value="fast_charging">Fast Charging</option></select>{errors.chargerType && <small>{errors.chargerType}</small>}</label>
          {editing && <label className="station-field"><span>Status</span><select name="status" value={form.status} onChange={update}><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option></select>{errors.status && <small>{errors.status}</small>}</label>}
          <div className="station-form-actions"><button className="ride-search-button" type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add station"}</button><button className="ride-reset-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
        </form>
      </section>
    </div>
  );
}

function StationDetails({ station, loading, error, onClose }) {
  return (
    <div className="station-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="station-modal station-details-modal" role="dialog" aria-modal="true" aria-labelledby="station-details-title">
        <button className="station-modal-close" type="button" aria-label="Close station details" onClick={onClose}>×</button>
        {loading && <div className="rides-loading"><span className="loading-spinner" />Loading station details...</div>}
        {error && <p className="station-form-error" role="alert">We couldn't load this station's details. Please try again.</p>}
        {!loading && station && <>
          <span className="eyebrow eyebrow-dark">STATION DETAILS</span>
          <h2 id="station-details-title">{station.name}</h2>
          <p className="station-form-intro">{station.address}, {station.city}, {station.state}</p>
          <div className="station-detail-grid">
            <div><small>STATUS</small><strong>{station.status}</strong></div>
            <div><small>CHARGER TYPE</small><strong>{chargerLabel(station.chargerType)}</strong></div>
            <div><small>SLOTS</small><strong>{station.availableSlots} available of {station.totalSlots}</strong></div>
            <div><small>PRICE</small><strong>{formatPrice(station.chargingPrice)} / unit</strong></div>
            <div><small>LATITUDE</small><strong>{station.latitude}</strong></div>
            <div><small>LONGITUDE</small><strong>{station.longitude}</strong></div>
            {station.distanceKm !== undefined && <div><small>DISTANCE</small><strong>{station.distanceKm} km</strong></div>}
          </div>
          <button type="button" className="station-details-button details-close-button" onClick={onClose}>Close</button>
        </>}
      </section>
    </div>
  );
}

export default function ChargingStations() {
  const { user } = useAuth();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [nearbyEmpty, setNearbyEmpty] = useState(false);
  const [coordinates, setCoordinates] = useState({ latitude: "", longitude: "", radius: "10" });
  const [coordinateError, setCoordinateError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]);
  const [notice, setNotice] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailStation, setDetailStation] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  async function loadStations() {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await api.get("/charging-stations");
      setStations(Array.isArray(data.stations) ? data.stations : []);
      setNearbyMode(false);
      setNearbyEmpty(false);
    } catch (_requestError) {
      setLoadError(true);
      setStations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStations(); }, []);

  async function findNearby(event) {
    event.preventDefault();
    const latitude = coordinates.latitude.trim() === "" ? NaN : Number(coordinates.latitude);
    const longitude = coordinates.longitude.trim() === "" ? NaN : Number(coordinates.longitude);
    const radius = coordinates.radius.trim() === "" ? NaN : Number(coordinates.radius);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isFinite(radius) || radius <= 0 || radius > 500) {
      setCoordinateError("Enter valid coordinates (latitude −90 to 90, longitude −180 to 180) and a radius above 0 up to 500 km.");
      return;
    }
    setCoordinateError("");
    setNearbyError("");
    setNearbyLoading(true);
    try {
      const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), radius: String(radius) });
      const { data } = await api.get(`/charging-stations/nearby?${params.toString()}`);
      const results = Array.isArray(data.stations) ? data.stations.map((item) => ({ ...item.station, distanceKm: item.distanceKm })) : [];
      setStations(results);
      setNearbyMode(true);
      setNearbyEmpty(results.length === 0);
    } catch (_requestError) {
      setNearbyError("Nearby stations couldn't be loaded. Check your coordinates and try again.");
    } finally {
      setNearbyLoading(false);
    }
  }

  function clearNearby() {
    setCoordinateError("");
    setNearbyError("");
    setNearbyMode(false);
    setNearbyEmpty(false);
    loadStations();
  }

  function openCreate() {
    setEditingStation(null);
    setForm(blankForm());
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(station) {
    setEditingStation(station);
    setForm(stationForm(station));
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingStation(null);
  }

  async function saveStation(event) {
    event.preventDefault();
    const errors = validateStation(form);
    setFormErrors(errors);
    setFormError("");
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const payload = formPayload(form);
      if (editingStation) {
        const { data } = await api.put(`/charging-stations/${editingStation._id}`, payload);
        setStations((current) => current.map((station) => station._id === editingStation._id ? { ...data.station, ...(station.distanceKm !== undefined ? { distanceKm: station.distanceKm } : {}) } : station));
        setNotice("Charging station updated successfully.");
      } else {
        const { data } = await api.post("/charging-stations", payload);
        setStations((current) => [data.station, ...current]);
        setNotice("Charging station added successfully.");
      }
      setFormOpen(false);
      setEditingStation(null);
    } catch (error) {
      if (error.response?.status === 400) setFormError("Some station details are invalid. Review the highlighted fields and try again.");
      else setFormError("We couldn't save this charging station. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function showDetails(id) {
    setDetailsOpen(true);
    setDetailLoading(true);
    setDetailError(false);
    setDetailStation(null);
    try {
      const { data } = await api.get(`/charging-stations/${id}`);
      const existing = stations.find((station) => station._id === id);
      setDetailStation({ ...data.station, ...(existing?.distanceKm !== undefined ? { distanceKm: existing.distanceKm } : {}) });
    } catch (_requestError) {
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  }

  async function deleteStation(station) {
    if (deletingIds.includes(station._id) || !window.confirm(`Mark ${station.name} as inactive?`)) return;
    setDeletingIds((current) => [...current, station._id]);
    setNotice("");
    try {
      const { data } = await api.delete(`/charging-stations/${station._id}`);
      const updated = { ...data.station, ...(station.distanceKm !== undefined ? { distanceKm: station.distanceKm } : {}) };
      setStations((current) => current.map((item) => item._id === station._id ? updated : item));
      if (detailStation?._id === station._id) setDetailStation(updated);
      setNotice("Station marked inactive.");
    } catch (_requestError) {
      setNotice("We couldn't update this station. Please try again.");
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== station._id));
    }
  }

  function updateCoordinates(event) {
    setCoordinates((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <div className="stations-page">
      <section className="stations-hero">
        <div><span className="eyebrow eyebrow-dark"><span className="live-dot" /> CHARGING NETWORK</span><h1>Power up<br /><span>along the way.</span></h1><p>Find active EV charging stations and check their current availability.</p></div>
        <div className="stations-hero-mark" aria-hidden="true">ϟ<small>CHARGE<br />READY</small></div>
      </section>

      <section className="nearby-panel" aria-labelledby="nearby-heading">
        <div className="nearby-heading"><div><span className="eyebrow eyebrow-dark">SEARCH BY LOCATION</span><h2 id="nearby-heading">Find Nearby Stations</h2></div><span className="nearby-limit">Up to 500 km · default 10 km</span></div>
        <form className="nearby-form" onSubmit={findNearby}>
          <label className="station-field"><span>Latitude</span><input name="latitude" type="number" min="-90" max="90" step="any" placeholder="12.9716" value={coordinates.latitude} onChange={updateCoordinates} /></label>
          <label className="station-field"><span>Longitude</span><input name="longitude" type="number" min="-180" max="180" step="any" placeholder="77.5946" value={coordinates.longitude} onChange={updateCoordinates} /></label>
          <label className="station-field"><span>Radius (km)</span><input name="radius" type="number" min="0.01" max="500" step="any" value={coordinates.radius} onChange={updateCoordinates} /></label>
          <div className="nearby-actions"><button className="ride-search-button" type="submit" disabled={nearbyLoading}>{nearbyLoading ? "Searching…" : "Find Nearby"}</button><button className="ride-reset-button" type="button" onClick={clearNearby}>Clear / Show All</button></div>
        </form>
        {coordinateError && <p className="station-inline-error" role="alert">{coordinateError}</p>}
      </section>

      <section className="stations-content" aria-live="polite">
        <div className="stations-heading"><div><span className="eyebrow eyebrow-dark">{nearbyMode ? "NEAR YOUR LOCATION" : "ACTIVE LOCATIONS"}</span><h2>{nearbyMode ? "Nearby charging stations" : "Charging Stations"}</h2></div><button type="button" className="ride-search-button add-station-button" onClick={openCreate}><span aria-hidden="true">＋</span> Add Charging Station</button></div>
        {notice && <p className={`station-notice${notice.startsWith("We couldn't") ? " station-notice-error" : ""}`} role={notice.startsWith("We couldn't") ? "alert" : "status"}>{notice}</p>}
        {loadError && !nearbyMode && <div className="rides-message rides-error"><span className="message-mark" aria-hidden="true">!</span><h3>We couldn't load charging stations.</h3><p>Please check your connection and try again.</p><button className="ride-search-button" type="button" onClick={loadStations}>Retry</button></div>}
        {nearbyError && <div className="rides-message rides-error"><span className="message-mark" aria-hidden="true">!</span><h3>Nearby search failed.</h3><p>{nearbyError}</p><button className="ride-search-button" type="button" onClick={findNearby}>Retry</button></div>}
        {loading && !nearbyMode && <div className="rides-loading"><span className="loading-spinner" />Loading charging stations...</div>}
        {nearbyLoading && <div className="rides-loading"><span className="loading-spinner" />Finding nearby charging stations...</div>}
        {!loading && !loadError && !nearbyLoading && !nearbyError && stations.length === 0 && <div className="rides-message rides-empty"><span className="message-mark" aria-hidden="true">ϟ</span><h3>{nearbyEmpty ? "No charging stations found in this area." : "No charging stations found."}</h3><p>{nearbyEmpty ? "Try a larger radius or show all active stations." : "There are no active stations to show right now."}</p>{nearbyEmpty ? <button type="button" className="ride-reset-button empty-reset" onClick={clearNearby}>Show All Stations</button> : <button type="button" className="ride-search-button" onClick={openCreate}>Add Charging Station</button>}</div>}
        {!loadError && !nearbyError && !loading && !nearbyLoading && stations.length > 0 && <div className="stations-grid">{stations.map((station) => <StationCard key={station._id} station={station} isOwner={String(station.createdBy) === String(user?.id || user?._id)} onDetails={showDetails} onEdit={openEdit} onDelete={deleteStation} deleting={deletingIds.includes(station._id)} />)}</div>}
      </section>

      {formOpen && <StationForm form={form} setForm={setForm} onSubmit={saveStation} onClose={closeForm} busy={saving} error={formError} errors={formErrors} editing={Boolean(editingStation)} />}
      {detailsOpen && <StationDetails station={detailStation} loading={detailLoading} error={detailError} onClose={() => setDetailsOpen(false)} />}
    </div>
  );
}
