import { useEffect, useState } from "react";
import api from "../services/api.js";

const statusLabels = {
  not_charging: "Not Charging",
  charging: "Charging",
  fully_charged: "Fully Charged"
};

function emptyForm() {
  return {
    make: "",
    model: "",
    year: "",
    registrationNumber: "",
    batteryCapacity: "",
    batteryPercentage: "",
    estimatedRange: "",
    chargingStatus: "not_charging"
  };
}

function numberOrEmpty(value) {
  return value === "" ? NaN : Number(value);
}

function validateForm(form, editing) {
  const errors = {};
  const year = numberOrEmpty(form.year);
  if (!form.make.trim()) errors.make = "Enter the vehicle make.";
  if (!form.model.trim()) errors.model = "Enter the vehicle model.";
  if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) {
    errors.year = `Enter a whole year from 1886 to ${new Date().getFullYear() + 1}.`;
  }
  if (!editing) {
    const capacity = numberOrEmpty(form.batteryCapacity);
    const percentage = numberOrEmpty(form.batteryPercentage);
    const range = numberOrEmpty(form.estimatedRange);
    if (!form.registrationNumber.trim() || !/^[A-Za-z0-9 -]{4,15}$/.test(form.registrationNumber.trim())) {
      errors.registrationNumber = "Enter a registration number with 4–15 letters, numbers, spaces, or hyphens.";
    }
    if (!Number.isFinite(capacity) || capacity < 0.1) errors.batteryCapacity = "Battery capacity must be at least 0.1 kWh.";
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) errors.batteryPercentage = "Battery percentage must be from 0 to 100.";
    if (!Number.isFinite(range) || range < 0) errors.estimatedRange = "Estimated range cannot be negative.";
  } else {
    const percentage = numberOrEmpty(form.batteryPercentage);
    const range = numberOrEmpty(form.estimatedRange);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) errors.batteryPercentage = "Battery percentage must be from 0 to 100.";
    if (!Number.isFinite(range) || range < 0) errors.estimatedRange = "Estimated range cannot be negative.";
  }
  if (!["not_charging", "charging", "fully_charged"].includes(form.chargingStatus)) {
    errors.chargingStatus = "Choose a valid charging status.";
  }
  return errors;
}

function payloadFrom(form, editing) {
  if (editing) {
    return {
      model: form.model.trim(),
      year: Number(form.year),
      batteryPercentage: Number(form.batteryPercentage),
      estimatedRange: Number(form.estimatedRange),
      chargingStatus: form.chargingStatus
    };
  }
  return {
    make: form.make.trim(),
    model: form.model.trim(),
    year: Number(form.year),
    registrationNumber: form.registrationNumber.trim(),
    batteryCapacity: Number(form.batteryCapacity),
    batteryPercentage: Number(form.batteryPercentage),
    estimatedRange: Number(form.estimatedRange),
    chargingStatus: form.chargingStatus
  };
}

function VehicleCard({ vehicle, onEdit, onDelete, deleting }) {
  return (
    <article className="vehicle-card">
      <div className="vehicle-card-top">
        <span className="vehicle-kind"><span aria-hidden="true">⚡</span> ELECTRIC VEHICLE</span>
        <span className={`vehicle-charging-status status-${vehicle.chargingStatus}`}>
          <span className="vehicle-status-dot" />{statusLabels[vehicle.chargingStatus] || vehicle.chargingStatus}
        </span>
      </div>
      <div className="vehicle-title-row">
        <div><h3>{vehicle.make} {vehicle.model}</h3><p>Model year {vehicle.year}</p></div>
        <span className="vehicle-battery-glyph" aria-hidden="true">⚡</span>
      </div>
      <div className="vehicle-registration"><span>REGISTRATION</span><strong>{vehicle.registrationNumber}</strong></div>
      <div className="vehicle-battery-block">
        <div className="vehicle-battery-label"><span>Battery level</span><strong>{vehicle.batteryPercentage}%</strong></div>
        <div className="vehicle-battery-track" role="progressbar" aria-label="Battery percentage" aria-valuemin="0" aria-valuemax="100" aria-valuenow={vehicle.batteryPercentage}><span style={{ width: `${vehicle.batteryPercentage}%` }} /></div>
      </div>
      <div className="vehicle-specs">
        <div><small>BATTERY CAPACITY</small><strong>{vehicle.batteryCapacity} kWh</strong></div>
        <div><small>ESTIMATED RANGE</small><strong>{vehicle.estimatedRange} km</strong></div>
      </div>
      <div className="vehicle-card-actions">
        <button type="button" className="vehicle-edit-button" onClick={() => onEdit(vehicle)}>Edit</button>
        <button type="button" className="vehicle-delete-button" disabled={deleting} onClick={() => onDelete(vehicle)}>{deleting ? "Deleting…" : "Delete"}</button>
      </div>
    </article>
  );
}

function VehicleForm({ vehicle, form, setForm, onSubmit, onClose, busy, error, fieldErrors }) {
  const editing = Boolean(vehicle);
  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <div className="vehicle-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title">
        <button className="vehicle-modal-close" type="button" aria-label="Close vehicle form" disabled={busy} onClick={onClose}>×</button>
        <span className="eyebrow eyebrow-dark">YOUR ELECTRIC GARAGE</span>
        <h2 id="vehicle-form-title">{editing ? "Edit EV vehicle" : "Add an EV vehicle"}</h2>
        <p className="vehicle-form-intro">{editing ? "Update the details you can change for this vehicle." : "Add your vehicle details to keep its battery information handy."}</p>
        {error && <p className="vehicle-form-error" role="alert">{error}</p>}
        {editing && <div className="vehicle-locked-fields"><span>{vehicle.make} · {vehicle.registrationNumber}</span><small>Make, registration, and battery capacity cannot be changed here.</small></div>}
        <form className="vehicle-form" onSubmit={onSubmit} noValidate>
          {!editing && <>
            <label className="vehicle-field"><span>Make</span><input name="make" value={form.make} onChange={update} autoComplete="off" />{fieldErrors.make && <small>{fieldErrors.make}</small>}</label>
            <label className="vehicle-field"><span>Model</span><input name="model" value={form.model} onChange={update} autoComplete="off" />{fieldErrors.model && <small>{fieldErrors.model}</small>}</label>
          </>}
          {editing && <label className="vehicle-field"><span>Model</span><input name="model" value={form.model} onChange={update} />{fieldErrors.model && <small>{fieldErrors.model}</small>}</label>}
          <label className="vehicle-field"><span>Year</span><input name="year" type="number" min="1886" max={new Date().getFullYear() + 1} step="1" value={form.year} onChange={update} />{fieldErrors.year && <small>{fieldErrors.year}</small>}</label>
          {!editing && <>
            <label className="vehicle-field"><span>Registration number</span><input name="registrationNumber" value={form.registrationNumber} onChange={update} autoComplete="off" />{fieldErrors.registrationNumber && <small>{fieldErrors.registrationNumber}</small>}</label>
            <label className="vehicle-field"><span>Battery capacity (kWh)</span><input name="batteryCapacity" type="number" min="0.1" step="any" value={form.batteryCapacity} onChange={update} />{fieldErrors.batteryCapacity && <small>{fieldErrors.batteryCapacity}</small>}</label>
          </>}
          <label className="vehicle-field"><span>Battery percentage</span><input name="batteryPercentage" type="number" min="0" max="100" step="any" value={form.batteryPercentage} onChange={update} />{fieldErrors.batteryPercentage && <small>{fieldErrors.batteryPercentage}</small>}</label>
          <label className="vehicle-field"><span>Estimated range (km)</span><input name="estimatedRange" type="number" min="0" step="any" value={form.estimatedRange} onChange={update} />{fieldErrors.estimatedRange && <small>{fieldErrors.estimatedRange}</small>}</label>
          <label className="vehicle-field"><span>Charging status</span><select name="chargingStatus" value={form.chargingStatus} onChange={update}><option value="not_charging">Not Charging</option><option value="charging">Charging</option><option value="fully_charged">Fully Charged</option></select>{fieldErrors.chargingStatus && <small>{fieldErrors.chargingStatus}</small>}</label>
          <div className="vehicle-form-actions"><button className="ride-search-button" type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add vehicle"}</button><button className="ride-reset-button" type="button" disabled={busy} onClick={onClose}>Cancel</button></div>
        </form>
      </section>
    </div>
  );
}

export default function MyVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]);
  const [notice, setNotice] = useState("");

  async function loadVehicles() {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await api.get("/vehicles/my");
      setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
    } catch (_requestError) {
      setLoadError(true);
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadVehicles(); }, []);

  function openCreateForm() {
    setEditingVehicle(null);
    setForm(emptyForm());
    setFieldErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function openEditForm(vehicle) {
    setEditingVehicle(vehicle);
    setForm({
      ...emptyForm(),
      make: vehicle.make,
      model: vehicle.model,
      year: String(vehicle.year),
      registrationNumber: vehicle.registrationNumber,
      batteryCapacity: String(vehicle.batteryCapacity),
      batteryPercentage: String(vehicle.batteryPercentage),
      estimatedRange: String(vehicle.estimatedRange),
      chargingStatus: vehicle.chargingStatus
    });
    setFieldErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingVehicle(null);
  }

  async function saveVehicle(event) {
    event.preventDefault();
    const errors = validateForm(form, Boolean(editingVehicle));
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      if (editingVehicle) {
        const { data } = await api.put(`/vehicles/${editingVehicle._id}`, payloadFrom(form, true));
        setVehicles((current) => current.map((vehicle) => vehicle._id === editingVehicle._id ? data.vehicle : vehicle));
        setNotice("Vehicle updated successfully.");
      } else {
        const { data } = await api.post("/vehicles", payloadFrom(form, false));
        setVehicles((current) => [data.vehicle, ...current]);
        setNotice("EV vehicle added successfully.");
      }
      setFormOpen(false);
      setEditingVehicle(null);
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message;
      if (status === 409) setFormError("That registration number is already in use. Check it and try again.");
      else if (status === 400 && typeof message === "string" && /registration number/i.test(message)) setFormError("Check the registration number and try again.");
      else setFormError("We couldn't save this vehicle. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVehicle(vehicle) {
    if (deletingIds.includes(vehicle._id) || !window.confirm(`Delete ${vehicle.make} ${vehicle.model}?`)) return;
    setDeletingIds((current) => [...current, vehicle._id]);
    setNotice("");
    try {
      await api.delete(`/vehicles/${vehicle._id}`);
      setVehicles((current) => current.filter((item) => item._id !== vehicle._id));
      setNotice("Vehicle deleted successfully.");
    } catch (_requestError) {
      setNotice("We couldn't delete this vehicle. Please try again.");
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== vehicle._id));
    }
  }

  return (
    <div className="vehicles-page">
      <section className="vehicles-hero">
        <div><span className="eyebrow eyebrow-dark"><span className="live-dot" /> YOUR ELECTRIC GARAGE</span><h1>Meet your<br /><span>EV fleet.</span></h1><p>Keep your electric vehicles and battery details up to date.</p></div>
        <div className="vehicles-hero-mark" aria-hidden="true">⚡<small>EV<br />READY</small></div>
      </section>

      <section className="vehicles-content" aria-live="polite">
        <div className="vehicles-heading"><div><span className="eyebrow eyebrow-dark">YOUR VEHICLES</span><h2>My EV Vehicles</h2></div><button type="button" className="ride-search-button add-vehicle-button" onClick={openCreateForm}><span aria-hidden="true">＋</span> Add EV Vehicle</button></div>
        {notice && <p className={`vehicle-notice${notice.startsWith("We couldn't") ? " vehicle-notice-error" : ""}`} role={notice.startsWith("We couldn't") ? "alert" : "status"}>{notice}</p>}
        {loading && <div className="rides-loading"><span className="loading-spinner" />Loading your EV vehicles...</div>}
        {loadError && <div className="rides-message rides-error"><span className="message-mark" aria-hidden="true">!</span><h3>We couldn't load your vehicles.</h3><p>Please check your connection and try again.</p><button className="ride-search-button" type="button" onClick={loadVehicles}>Retry</button></div>}
        {!loading && !loadError && vehicles.length === 0 && <div className="rides-message rides-empty"><span className="message-mark" aria-hidden="true">⚡</span><h3>No EV vehicles added yet.</h3><p>Add your electric vehicle to keep its battery information handy.</p><button className="ride-search-button" type="button" onClick={openCreateForm}>Add EV Vehicle</button></div>}
        {!loading && !loadError && vehicles.length > 0 && <div className="vehicles-grid">{vehicles.map((vehicle) => <VehicleCard key={vehicle._id} vehicle={vehicle} onEdit={openEditForm} onDelete={deleteVehicle} deleting={deletingIds.includes(vehicle._id)} />)}</div>}
      </section>

      {formOpen && <VehicleForm vehicle={editingVehicle} form={form} setForm={setForm} onSubmit={saveVehicle} onClose={closeForm} busy={saving} error={formError} fieldErrors={fieldErrors} />}
    </div>
  );
}
