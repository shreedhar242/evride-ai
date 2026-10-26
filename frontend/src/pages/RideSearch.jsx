import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { filterAvailableRides, rideDateValue } from "../utils/rideFilters.js";

const emptyFilters = { pickup: "", destination: "", date: "" };

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatDate(value) {
  const date = rideDateValue(value);
  if (!date) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatFare(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function RideCard({ ride, userId, onBook }) {
  const vehicle = ride.vehicle;
  const vehicleName = vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(" ") : "EV vehicle";
  const isOwnRide = ride.driver?._id && String(ride.driver._id) === String(userId);

  return (
    <article className="ride-card">
      <div className="ride-card-top">
        <span className="ride-kind"><span aria-hidden="true">ϟ</span> ELECTRIC RIDE</span>
        <span className="ride-status"><span className="live-dot" /> {ride.status}</span>
      </div>
      <div className="ride-route">
        <div className="route-point"><span className="route-dot route-dot-start" /><div><small>FROM</small><strong>{ride.pickup}</strong></div></div>
        <div className="route-connector" aria-hidden="true"><span /></div>
        <div className="route-point"><span className="route-dot route-dot-end" /><div><small>TO</small><strong>{ride.destination}</strong></div></div>
      </div>
      <div className="ride-details">
        <div className="ride-detail"><span className="detail-symbol" aria-hidden="true">◷</span><span><small>DATE &amp; TIME</small><strong>{formatDate(ride.date)} · {ride.time}</strong></span></div>
        <div className="ride-detail"><span className="detail-symbol seats-symbol" aria-hidden="true">♙</span><span><small>SEATS LEFT</small><strong>{ride.availableSeats} available</strong></span></div>
        <div className="ride-detail"><span className="detail-symbol vehicle-symbol" aria-hidden="true">ϟ</span><span><small>VEHICLE</small><strong>{vehicleName}</strong></span></div>
        {ride.driver?.name && <div className="ride-detail"><span className="detail-symbol driver-symbol" aria-hidden="true">●</span><span><small>DRIVER</small><strong>{ride.driver.name}</strong></span></div>}
      </div>
      <div className="ride-card-bottom">
        <span className="fare-caption">EV fare <small>per seat</small></span>
        <strong className="ride-fare">{formatFare(ride.price)}</strong>
      </div>
      <div className="ride-book-action">
        {isOwnRide
          ? <span className="own-ride-note">You are the driver</span>
          : <button className="ride-search-button" type="button" onClick={() => onBook(ride)}>Book Ride</button>}
      </div>
    </article>
  );
}

export default function RideSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const demoPaymentMode = import.meta.env.VITE_PAYMENT_MODE === "demo";
  const [rides, setRides] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedRide, setSelectedRide] = useState(null);
  const [seatsBooked, setSeatsBooked] = useState("1");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingNotice, setBookingNotice] = useState("");

  async function loadRides() {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get("/rides");
      setRides(Array.isArray(data.rides) ? data.rides : []);
    } catch (_requestError) {
      setError(true);
      setRides([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRides();
  }, []);

  const availableRides = useMemo(
    () => filterAvailableRides(rides, appliedFilters),
    [rides, appliedFilters]
  );

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleSearch(event) {
    event.preventDefault();
    setAppliedFilters({
      pickup: filters.pickup.trim(),
      destination: filters.destination.trim(),
      date: filters.date
    });
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  function openBooking(ride) {
    setSelectedRide(ride);
    setSeatsBooked("1");
    setBookingError("");
    setBookingNotice("");
  }

  async function submitBooking(event) {
    event.preventDefault();
    const seats = Number(seatsBooked);
    if (!selectedRide || !Number.isInteger(seats) || seats < 1 || seats > selectedRide.availableSeats) {
      setBookingError(`Choose a whole number of seats from 1 to ${selectedRide?.availableSeats || 0}.`);
      return;
    }
    setBookingBusy(true);
    setBookingError("");
    try {
      if (demoPaymentMode) {
        const { data: result } = await api.post("/payments/demo", {
          rideId: selectedRide._id,
          seatsBooked: seats
        });
        if (!result.success || !result.booking || result.payment?.status !== "captured") {
          throw new Error("DEMO_PAYMENT_NOT_CONFIRMED");
        }
        await loadRides();
        setSelectedRide(null);
        navigate("/bookings", { state: { paymentNotice: "Payment successful. Your booking is confirmed. Demo payment status: captured." } });
        return;
      }

      const { data: order } = await api.post("/payments/create-order", {
        rideId: selectedRide._id,
        seatsBooked: seats
      });
      const checkoutReady = await loadRazorpayCheckout();
      if (!checkoutReady || !window.Razorpay) {
        await api.post("/payments/cancel", { orderId: order.orderId }).catch(() => {});
        throw new Error("CHECKOUT_UNAVAILABLE");
      }

      let callbackHandled = false;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "EVRide AI",
        description: `${selectedRide.pickup} to ${selectedRide.destination}`,
        prefill: { name: user?.name || "", email: user?.email || "" },
        handler: async (paymentResponse) => {
          callbackHandled = true;
          try {
            const { data: verification } = await api.post("/payments/verify", paymentResponse);
            if (!verification.success || !verification.booking) throw new Error("PAYMENT_NOT_CONFIRMED");
            await loadRides();
            setSelectedRide(null);
            navigate("/bookings", { state: { paymentNotice: "Payment verified. Your booking is confirmed." } });
          } catch (verificationError) {
            const status = verificationError.response?.status;
            setBookingError(status === 409
              ? "The payment could not be matched to an available booking. Check My Bookings for the latest status."
              : "We couldn't verify this payment. Your booking has not been confirmed.");
            await loadRides();
          } finally {
            setBookingBusy(false);
          }
        },
        modal: {
          ondismiss: async () => {
            if (!callbackHandled) {
              await api.post("/payments/cancel", { orderId: order.orderId }).catch(() => {});
              setBookingError("Checkout was cancelled. No seats were booked.");
              setBookingBusy(false);
            }
          }
        },
        theme: { color: "#39764e" }
      });
      checkout.on("payment.failed", async () => {
        callbackHandled = true;
        await api.post("/payments/failure", { orderId: order.orderId }).catch(() => {});
        setBookingError("Payment failed. No seats were booked. You can try again.");
        setBookingBusy(false);
      });
      checkout.open();
    } catch (requestError) {
      const status = requestError.response?.status;
      setBookingError(requestError.message === "DEMO_PAYMENT_NOT_CONFIRMED"
        ? "Demo payment could not be confirmed. No booking was made. Please try again."
        : requestError.message === "CHECKOUT_UNAVAILABLE"
          ? "Secure checkout could not be loaded. No seats were booked. Please try again."
        : status === 503
          ? "Razorpay Test Mode is not configured yet. Ask the project owner to configure test credentials."
          : status === 409
            ? "This ride may no longer have enough seats, or you already have an active booking. Refresh rides and try again."
            : status === 403
              ? "You cannot book your own ride."
              : "We couldn't start secure checkout. Please try again.");
      setBookingBusy(false);
    }
  }

  return (
    <div className="ride-search-page">
      <section className="rides-hero">
        <div>
          <span className="eyebrow eyebrow-dark"><span className="live-dot" /> FIND YOUR NEXT RIDE</span>
          <h1>Good trips<br /><span>start here.</span></h1>
          <p>Search scheduled EV rides and find a route that works for you.</p>
        </div>
        <div className="rides-hero-mark" aria-hidden="true"><span>ϟ</span><small>EV<br />READY</small></div>
      </section>

      <section className="ride-search-panel" aria-labelledby="ride-search-heading">
        <div className="ride-search-heading">
          <div><span className="eyebrow eyebrow-dark">PLAN YOUR ROUTE</span><h2 id="ride-search-heading">Where would you like to go?</h2></div>
          <span className="filter-note">Filter available rides</span>
        </div>
        <form className="ride-filter-form" onSubmit={handleSearch}>
          <label className="filter-field"><span>Pickup</span><input name="pickup" type="text" placeholder="e.g. Bengaluru" value={filters.pickup} onChange={updateFilter} /></label>
          <label className="filter-field"><span>Destination</span><input name="destination" type="text" placeholder="e.g. Mysuru" value={filters.destination} onChange={updateFilter} /></label>
          <label className="filter-field filter-date"><span>Date</span><input name="date" type="date" value={filters.date} onChange={updateFilter} /></label>
          <div className="filter-actions"><button className="ride-search-button" type="submit">Search rides <span aria-hidden="true">→</span></button><button className="ride-reset-button" type="button" onClick={clearFilters}>Clear</button></div>
        </form>
      </section>

      <section className="ride-results" aria-live="polite">
        <div className="ride-results-heading"><div><span className="eyebrow eyebrow-dark">YOUR OPTIONS</span><h2>Available EV rides</h2></div>{!loading && !error && <span className="result-count">{availableRides.length} {availableRides.length === 1 ? "RIDE" : "RIDES"}</span>}</div>

        {loading && <div className="rides-loading"><span className="loading-spinner" />Loading available EV rides...</div>}

        {error && <div className="rides-message rides-error"><span className="message-mark" aria-hidden="true">!</span><h3>Rides are taking a short detour.</h3><p>We couldn't load available rides right now. Please try again.</p><button className="ride-search-button" type="button" onClick={loadRides}>Retry <span aria-hidden="true">↻</span></button></div>}

        {!loading && !error && availableRides.length === 0 && <div className="rides-message rides-empty"><span className="message-mark" aria-hidden="true">⌖</span><h3>No EV rides found.</h3><p>Try another route or clear your filters to see all available rides.</p><button className="ride-reset-button empty-reset" type="button" onClick={clearFilters}>Clear filters</button></div>}

        {bookingNotice && <p className="booking-feedback booking-success" role="status">{bookingNotice} <Link to="/bookings">View My Bookings</Link></p>}
        {!loading && !error && availableRides.length > 0 && <div className="rides-grid">{availableRides.map((ride) => <RideCard key={ride._id} ride={ride} userId={user?._id || user?.id} onBook={openBooking} />)}</div>}
      </section>

      {selectedRide && <div className="booking-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !bookingBusy) setSelectedRide(null); }}>
        <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
          <button className="booking-modal-close" type="button" aria-label="Close booking form" disabled={bookingBusy} onClick={() => setSelectedRide(null)}>×</button>
          <span className="eyebrow eyebrow-dark">CONFIRM YOUR SEATS</span>
          <h2 id="booking-modal-title">{demoPaymentMode ? "Demo payment for this ride" : "Pay for this EV ride"}</h2>
          <p className="booking-modal-route">{selectedRide.pickup} <span aria-hidden="true">→</span> {selectedRide.destination}</p>
          <form onSubmit={submitBooking}>
            <label className="filter-field"><span>Number of seats (up to {selectedRide.availableSeats})</span><input type="number" min="1" max={selectedRide.availableSeats} step="1" value={seatsBooked} onChange={(event) => setSeatsBooked(event.target.value)} required /></label>
            <div className="booking-payment-summary">
              <div><span>Comparable fare</span><strong>{selectedRide.comparableFare == null ? "Not recorded" : formatFare(selectedRide.comparableFare)}</strong></div>
              <div><span>EV discount</span><strong>{selectedRide.discountPercentage == null ? "Not recorded" : `${selectedRide.discountPercentage}%`}</strong></div>
              <div><span>Final EV fare / seat</span><strong>{formatFare(selectedRide.price)}</strong></div>
              <div className="booking-total-preview"><span>Total for {Number(seatsBooked) || 0} seat(s)</span><strong>{formatFare((Number(selectedRide.price) || 0) * (Number(seatsBooked) || 0))}</strong></div>
              <small>{demoPaymentMode ? "The server calculates the amount from the stored ride fare. No payment credentials are collected." : "The server recalculates and verifies the amount before creating the payment order."}</small>
            </div>
            {bookingError && <p className="booking-feedback booking-failure" role="alert">{bookingError}</p>}
            {demoPaymentMode && <p className="demo-payment-notice">Demo Payment (Development Only) · No real money is charged.</p>}
            <div className="booking-modal-actions"><button className="ride-search-button" type="submit" disabled={bookingBusy}>{bookingBusy ? (demoPaymentMode ? "Processing demo payment..." : "Opening secure checkout...") : (demoPaymentMode ? "Demo Payment (Development Only)" : "Pay Now")}</button><button className="ride-reset-button" type="button" disabled={bookingBusy} onClick={() => setSelectedRide(null)}>Back</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}
