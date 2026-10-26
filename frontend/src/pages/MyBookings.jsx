import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../services/api.js";
import { rideDateValue } from "../utils/rideFilters.js";

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

function BookingCard({ booking, payment, onCancel, cancelling }) {
  const ride = booking.ride;
  const cancelled = booking.status === "cancelled";

  return (
    <article className={`booking-card${cancelled ? " booking-card-cancelled" : ""}`}>
      <div className="booking-card-top">
        <span className="booking-kind">EV RIDE BOOKING</span>
        <span className={`booking-status${cancelled ? " booking-status-cancelled" : ""}`}>
          <span className="booking-status-dot" />{booking.status}
        </span>
      </div>

      {ride ? (
        <>
          <div className="booking-route">
            <div><small>FROM</small><strong>{ride.pickup}</strong></div>
            <span className="booking-route-arrow" aria-hidden="true">→</span>
            <div><small>TO</small><strong>{ride.destination}</strong></div>
          </div>
          <div className="booking-details">
            <div><small>RIDE DATE &amp; TIME</small><strong>{formatDate(ride.date)} · {ride.time}</strong></div>
            <div><small>SEATS BOOKED</small><strong>{booking.seatsBooked}</strong></div>
            {ride.driver?.name && <div><small>DRIVER</small><strong>{ride.driver.name}</strong></div>}
            {booking.createdAt && <div><small>BOOKED ON</small><strong>{formatDate(booking.createdAt)}</strong></div>}
          </div>
        </>
      ) : (
        <p className="booking-unavailable">Ride details are no longer available.</p>
      )}

      <div className="booking-card-bottom">
        <span>Total Fare</span>
        <strong>{formatFare(booking.totalPrice)}</strong>
      </div>
      {payment && <div className="booking-payment-status"><span>Payment status</span><strong>{payment.status}</strong></div>}
      {booking.status === "confirmed" && (
        <button
          className="cancel-booking-button"
          type="button"
          disabled={cancelling}
          onClick={() => onCancel(booking)}
        >
          {cancelling ? "Cancelling…" : "Cancel Booking"}
        </button>
      )}
    </article>
  );
}

export default function MyBookings() {
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [paymentsByBooking, setPaymentsByBooking] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [notice, setNotice] = useState(location.state?.paymentNotice || "");
  const [cancelError, setCancelError] = useState("");

  async function loadBookings() {
    setLoading(true);
    setLoadError(false);
    try {
      const [bookingResult, paymentResult] = await Promise.allSettled([
        api.get("/bookings/my"),
        api.get("/payments/my")
      ]);
      if (bookingResult.status !== "fulfilled") throw bookingResult.reason;
      setBookings(Array.isArray(bookingResult.value.data.bookings) ? bookingResult.value.data.bookings : []);
      const paymentRows = paymentResult.status === "fulfilled" && Array.isArray(paymentResult.value.data.payments)
        ? paymentResult.value.data.payments
        : [];
      setPaymentsByBooking(Object.fromEntries(paymentRows
        .filter((payment) => payment.booking)
        .map((payment) => [String(payment.booking), payment])));
    } catch (_requestError) {
      setLoadError(true);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  async function cancelBooking(booking) {
    if (cancellingId || !window.confirm("Are you sure you want to cancel this booking?")) return;
    setCancellingId(booking._id);
    setCancelError("");
    setNotice("");
    try {
      const { data } = await api.put(`/bookings/${booking._id}/cancel`);
      setBookings((current) => current.map((item) => item._id === booking._id ? data.booking : item));
      setNotice("Booking cancelled successfully.");
    } catch (error) {
      const status = error.response?.status;
      setCancelError(status === 409
        ? "This booking is already cancelled. Refresh your bookings to see the latest status."
        : "We couldn't cancel this booking. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="bookings-page">
      <section className="bookings-hero">
        <span className="eyebrow eyebrow-dark"><span className="live-dot" /> YOUR TRIPS</span>
        <h1>Your bookings,<br /><span>all in one place.</span></h1>
        <p>Review your EV ride details and manage confirmed bookings.</p>
      </section>

      <section className="bookings-content" aria-live="polite">
        <div className="bookings-heading"><div><span className="eyebrow eyebrow-dark">TRIP HISTORY</span><h2>My Bookings</h2></div></div>
        {notice && <p className="booking-feedback booking-success" role="status">{notice}</p>}
        {cancelError && <p className="booking-feedback booking-failure" role="alert">{cancelError}</p>}

        {loading && <div className="rides-loading"><span className="loading-spinner" />Loading your bookings...</div>}

        {loadError && <div className="rides-message rides-error"><span className="message-mark" aria-hidden="true">!</span><h3>We couldn't load your bookings.</h3><p>Please check your connection and try again.</p><button className="ride-search-button" type="button" onClick={loadBookings}>Retry</button></div>}

        {!loading && !loadError && bookings.length === 0 && <div className="rides-message rides-empty"><span className="message-mark" aria-hidden="true">↗</span><h3>No bookings found.</h3><p>Find an EV ride that works for your journey.</p><Link className="ride-search-button find-rides-link" to="/rides">Find EV Rides</Link></div>}

        {!loading && !loadError && bookings.length > 0 && <div className="bookings-grid">{bookings.map((booking) => <BookingCard key={booking._id} booking={booking} payment={paymentsByBooking[String(booking._id)]} cancelling={cancellingId === booking._id} onCancel={cancelBooking} />)}</div>}
      </section>
    </div>
  );
}
