import { useEffect, useState } from "react";
import api from "../services/api.js";
import { rideDateValue } from "../utils/rideFilters.js";

function blankRide() {
  return {
    make: "", model: "", number: "", pickup: "", destination: "", date: "", time: "", availableSeats: "", comparableFare: ""
  };
}

function formatDate(value) {
  const date = rideDateValue(value);
  if (!date) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatFare(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function validateRide(form, editingRide) {
  const errors = {};
  for (const field of ["make", "model", "number", "pickup", "destination"]) {
    if (!form[field].trim()) errors[field] = "This field is required.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = "Choose a valid ride date.";
  else if (form.date < new Date().toISOString().slice(0, 10)) errors.date = "Ride date cannot be in the past.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) errors.time = "Use 24-hour time, such as 09:30.";
  const seats = form.availableSeats === "" ? NaN : Number(form.availableSeats);
  if (!Number.isInteger(seats) || seats < 1) errors.availableSeats = "Enter at least one available seat.";
  const comparableFare = form.comparableFare === "" ? NaN : Number(form.comparableFare);
  if ((!editingRide || form.comparableFare !== "") && (!Number.isFinite(comparableFare) || comparableFare <= 0)) {
    errors.comparableFare = "Enter a positive comparable fare.";
  }
  return errors;
}

function ridePayload(form) {
  const payload = {
    vehicle: { make: form.make.trim(), model: form.model.trim(), number: form.number.trim() },
    pickup: form.pickup.trim(),
    destination: form.destination.trim(),
    date: form.date,
    time: form.time,
    availableSeats: Number(form.availableSeats)
  };
  if (form.comparableFare !== "") payload.comparableFare = Number(form.comparableFare);
  return payload;
}

function RideForm({ form, setForm, onSubmit, onClose, saving, error, errors, editing }) {
  const [pricingPreview, setPricingPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const comparableFare = Number(form.comparableFare);
    if (form.comparableFare === "" || !Number.isFinite(comparableFare) || comparableFare <= 0) {
      setPricingPreview(null);
      setPreviewLoading(false);
      return undefined;
    }

    let active = true;
    setPreviewLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.post("/pricing/ev-fare", { comparableFare });
        if (active) setPricingPreview(data);
      } catch (_requestError) {
        if (active) setPricingPreview(null);
      } finally {
        if (active) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.comparableFare]);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }
  const fields = [
    ["make", "Vehicle make", "text"], ["model", "Vehicle model", "text"], ["number", "Vehicle registration", "text"],
    ["pickup", "Pickup", "text"], ["destination", "Destination", "text"], ["date", "Ride date", "date"],
    ["time", "Departure time", "time"], ["availableSeats", "Available seats", "number"], ["comparableFare", "Comparable/base fare per seat (₹)", "number"]
  ];
  return (
    <div className="myride-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="myride-modal" role="dialog" aria-modal="true" aria-labelledby="myride-form-title">
        <button className="myride-modal-close" type="button" aria-label="Close ride form" disabled={saving} onClick={onClose}>×</button>
        <span className="eyebrow eyebrow-dark">DRIVER SPACE</span>
        <h2 id="myride-form-title">{editing ? "Edit your ride" : "Offer an EV ride"}</h2>
        <p className="myride-form-intro">{editing && form.comparableFare === ""
          ? "This older ride has no recorded comparable fare. Leave this blank to keep its current final fare, or enter a base fare to reprice it."
          : "Enter the comparable fare. The server applies the EV discount and sets the final passenger fare."}</p>
        {error && <p className="myride-form-error" role="alert">{error}</p>}
        <form className="myride-form" onSubmit={onSubmit} noValidate>
          {fields.map(([name, label, type]) => <label className="myride-field" key={name}><span>{label}</span><input name={name} type={type} min={name === "availableSeats" ? 1 : name === "comparableFare" ? 0.01 : undefined} step={name === "availableSeats" ? 1 : name === "comparableFare" ? "any" : undefined} value={form[name]} onChange={update} />{errors[name] && <small>{errors[name]}</small>}</label>)}
          <div className="myride-pricing-preview" aria-live="polite">
            <strong>EV fare calculation</strong>
            {previewLoading && <span>Calculating fare...</span>}
            {!previewLoading && pricingPreview?.success && <>
              <span>Comparable fare: {formatFare(pricingPreview.comparableFare)}</span>
              <span>EV discount: {pricingPreview.discountPercentage}%</span>
              <span>Final EV fare: {formatFare(pricingPreview.evFare)} / seat</span>
            </>}
            {!previewLoading && form.comparableFare !== "" && !pricingPreview?.success && <span>Fare preview unavailable. The server will calculate the final fare when you save.</span>}
            {!previewLoading && form.comparableFare === "" && <span>Enter a positive comparable fare to preview the final EV fare.</span>}
          </div>
          <div className="myride-form-actions"><button className="ride-search-button" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Publish ride"}</button><button className="ride-reset-button" type="button" disabled={saving} onClick={onClose}>Cancel</button></div>
        </form>
      </section>
    </div>
  );
}

function RideCard({ ride, onEdit, onCancel, onAdvance, cancelling, updating }) {
  const cancelled = ride.status === "cancelled";
  return (
    <article className={`myride-card${cancelled ? " myride-card-cancelled" : ""}`}>
      <div className="myride-card-top"><span className="ride-kind"><span aria-hidden="true">ϟ</span> YOUR EV RIDE</span><span className={`ride-status${cancelled ? " myride-cancelled-status" : ""}`}><span className="live-dot" />{ride.status}</span></div>
      <div className="myride-route"><div><small>FROM</small><strong>{ride.pickup}</strong></div><span aria-hidden="true">→</span><div><small>TO</small><strong>{ride.destination}</strong></div></div>
      <div className="myride-facts">
        <div><small>DATE &amp; TIME</small><strong>{formatDate(ride.date)} · {ride.time}</strong></div>
        <div><small>VEHICLE</small><strong>{ride.vehicle?.make} {ride.vehicle?.model}</strong></div>
        <div><small>AVAILABLE SEATS</small><strong>{ride.availableSeats}</strong></div>
        <div><small>COMPARABLE FARE</small><strong>{ride.comparableFare == null ? "Not recorded" : `${formatFare(ride.comparableFare)} / seat`}</strong></div>
        <div><small>EV DISCOUNT</small><strong>{ride.discountPercentage == null ? "Not recorded" : `${ride.discountPercentage}%`}</strong></div>
        <div><small>FINAL EV FARE</small><strong>{formatFare(ride.price)} / seat</strong></div>
        {ride.bookingSummary && <div><small>PASSENGERS</small><strong>{ride.bookingSummary.passengerCount} · {ride.bookingSummary.seatsBooked} seats booked</strong></div>}
      </div>
      {!cancelled && ride.status !== "completed" && <div className="myride-actions">
        {ride.status === "scheduled" || ride.status === "full"
          ? <button className="myride-edit-button" type="button" onClick={() => onEdit(ride)}>Edit ride</button>
          : null}
        {(ride.status === "scheduled" || ride.status === "full") && <button className="myride-edit-button" type="button" disabled={updating} onClick={() => onAdvance(ride, "ongoing")}>{updating ? "Updating…" : "Start ride"}</button>}
        {(ride.status === "ongoing" || ride.status === "started") && <button className="myride-edit-button" type="button" disabled={updating} onClick={() => onAdvance(ride, "completed")}>{updating ? "Updating…" : "Complete ride"}</button>}
        {ride.status !== "completed" && <button className="myride-cancel-button" type="button" disabled={cancelling || updating} onClick={() => onCancel(ride)}>{cancelling ? "Cancelling…" : "Cancel ride"}</button>}
      </div>}
    </article>
  );
}

export default function MyRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRide, setEditingRide] = useState(null);
  const [form, setForm] = useState(blankRide);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [notice, setNotice] = useState("");

  async function loadRides() {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await api.get("/rides/my");
      setRides(Array.isArray(data.rides) ? data.rides : []);
    } catch (_requestError) {
      setLoadError(true);
      setRides([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRides(); }, []);

  function openCreate() {
    setEditingRide(null);
    setForm(blankRide());
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(ride) {
    setEditingRide(ride);
    setForm({
      make: ride.vehicle?.make || "", model: ride.vehicle?.model || "", number: ride.vehicle?.number || "",
      pickup: ride.pickup || "", destination: ride.destination || "", date: rideDateValue(ride.date),
      time: ride.time || "", availableSeats: String(ride.availableSeats), comparableFare: ride.comparableFare == null ? "" : String(ride.comparableFare)
    });
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingRide(null);
  }

  async function saveRide(event) {
    event.preventDefault();
    const errors = validateRide(form, editingRide);
    setFormErrors(errors);
    setFormError("");
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const payload = ridePayload(form);
      if (editingRide) {
        const { data } = await api.put(`/rides/${editingRide._id}`, payload);
        setRides((current) => current.map((ride) => ride._id === editingRide._id ? data.ride : ride));
        setNotice("Ride updated successfully.");
      } else {
        const { data } = await api.post("/rides", payload);
        setRides((current) => [data.ride, ...current]);
        setNotice("Your ride is now listed.");
      }
      setFormOpen(false);
      setEditingRide(null);
    } catch (error) {
      const status = error.response?.status;
      setFormError(status === 400
        ? "Some ride details need attention. Check the form and try again."
        : "We couldn't save this ride. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelRide(ride) {
    if (cancellingId || !window.confirm("Cancel this ride? Passengers with bookings may be affected.")) return;
    setCancellingId(ride._id);
    setNotice("");
    try {
      const { data } = await api.delete(`/rides/${ride._id}`);
      setRides((current) => current.map((item) => item._id === ride._id ? data.ride : item));
      setNotice("Ride cancelled.");
    } catch (_requestError) {
      setNotice("We couldn't cancel this ride. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  async function advanceRide(ride, status) {
    if (updatingId || !["ongoing", "completed"].includes(status)) return;
    setUpdatingId(ride._id);
    setNotice("");
    try {
      const { data } = await api.put(`/rides/${ride._id}`, { status });
      setRides((current) => current.map((item) => item._id === ride._id ? { ...item, ...data.ride } : item));
      setNotice(status === "ongoing" ? "Ride started." : "Ride marked as completed.");
    } catch (error) {
      setNotice(error.response?.status === 400
        ? "This ride cannot move to that status. Refresh your ride list and try again."
        : "We couldn't update this ride. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="myrides-page">
      <section className="myrides-hero"><div><span className="eyebrow eyebrow-dark"><span className="live-dot" /> DRIVER SPACE</span><h1>Take the wheel<br /><span>of your next ride.</span></h1><p>Offer a scheduled EV ride and manage the trips you are hosting.</p></div><div className="myrides-hero-mark" aria-hidden="true">↗<small>DRIVE<br />ELECTRIC</small></div></section>
      <section className="myrides-content" aria-live="polite">
        <div className="myrides-heading"><div><span className="eyebrow eyebrow-dark">YOUR LISTINGS</span><h2>My Rides</h2></div><button className="ride-search-button" type="button" onClick={openCreate}><span aria-hidden="true">＋</span> Offer a Ride</button></div>
        {notice && <p className={`myrides-notice${notice.startsWith("We couldn't") ? " myrides-notice-error" : ""}`} role={notice.startsWith("We couldn't") ? "alert" : "status"}>{notice}</p>}
        {loading && <div className="rides-loading"><span className="loading-spinner" />Loading your rides...</div>}
        {loadError && <div className="rides-message rides-error"><span className="message-mark" aria-hidden="true">!</span><h3>We couldn't load your rides.</h3><p>Please check your connection and try again.</p><button className="ride-search-button" type="button" onClick={loadRides}>Retry</button></div>}
        {!loading && !loadError && rides.length === 0 && <div className="rides-message rides-empty"><span className="message-mark" aria-hidden="true">↗</span><h3>You have no active rides listed.</h3><p>Offer an EV ride and invite passengers to join your journey.</p><button className="ride-search-button" type="button" onClick={openCreate}>Offer a Ride</button></div>}
        {!loading && !loadError && rides.length > 0 && <div className="myrides-grid">{rides.map((ride) => <RideCard key={ride._id} ride={ride} onEdit={openEdit} onCancel={cancelRide} onAdvance={advanceRide} cancelling={cancellingId === ride._id} updating={updatingId === ride._id} />)}</div>}
      </section>
      {formOpen && <RideForm form={form} setForm={setForm} onSubmit={saveRide} onClose={closeForm} saving={saving} error={formError} errors={formErrors} editing={Boolean(editingRide)} />}
    </div>
  );
}
