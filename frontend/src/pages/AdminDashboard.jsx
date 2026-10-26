import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "rides", label: "Rides" },
  { id: "bookings", label: "Bookings" },
  { id: "payments", label: "Payments" },
  { id: "vehicles", label: "Vehicles" },
  { id: "charging-stations", label: "Charging Stations" }
];

const statCards = [
  ["totalUsers", "Total Users", "users"],
  ["totalRiders", "Riders", "riders"],
  ["totalDrivers", "Drivers", "drivers"],
  ["totalRides", "Total Rides", "rides"],
  ["totalBookings", "Total Bookings", "bookings"],
  ["totalPayments", "Total Payments", "payments"],
  ["successfulPayments", "Successful Payments", "success"],
  ["activeChargingStations", "Active Charging Stations", "stations"]
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function formatMoney(value, currency = "INR") {
  if (!Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

function personName(person) {
  return person?.name || person?.email || "—";
}

function paymentIdForBooking(payment) {
  return String(payment?.booking?._id || payment?.booking || "");
}

function DataTable({ columns, rows, emptyMessage }) {
  if (!rows?.length) return <div className="admin-empty">{emptyMessage}</div>;
  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row._id || row.id || index}>{columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function StatusBadge({ children, tone = "neutral" }) {
  return <span className={`admin-badge admin-badge-${tone}`}>{children}</span>;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [activeSection, setActiveSection] = useState("overview");
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [statusError, setStatusError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    setStatsLoading(true);
    setStatsError("");
    api.get("/admin/stats")
      .then(({ data }) => { if (active) setStats(data.stats || null); })
      .catch(() => { if (active) setStatsError("We couldn't load platform statistics. Please retry."); })
      .finally(() => { if (active) setStatsLoading(false); });
    return () => { active = false; };
  }, [isAdmin, reloadKey]);

  useEffect(() => {
    if (!isAdmin || activeSection === "overview") {
      setLoading(false);
      setRows([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    const requests = activeSection === "bookings"
      ? Promise.all([api.get("/admin/bookings"), api.get("/admin/payments")])
      : api.get(`/admin/${activeSection}`);
    requests
      .then((result) => {
        if (!active) return;
        if (activeSection === "bookings") {
          setRows(Array.isArray(result[0].data.bookings) ? result[0].data.bookings : []);
          setPaymentRows(Array.isArray(result[1].data.payments) ? result[1].data.payments : []);
        } else {
          const key = activeSection === "charging-stations" ? "chargingStations" : activeSection;
          setRows(Array.isArray(result.data[key]) ? result.data[key] : []);
        }
      })
      .catch(() => { if (active) { setRows([]); setError("We couldn't load this section. Please try again."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin, activeSection, reloadKey]);

  const paymentsByBooking = useMemo(() => new Map(
    paymentRows.filter((payment) => payment.booking).map((payment) => [paymentIdForBooking(payment), payment])
  ), [paymentRows]);

  function refresh() {
    setNotice("");
    setReloadKey((key) => key + 1);
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function updateUserStatus(target, isActive) {
    const targetId = String(target._id || target.id || "");
    if (!targetId || busyUserId) return;
    setBusyUserId(targetId);
    setStatusError("");
    setNotice("");
    try {
      const { data } = await api.patch(`/admin/users/${targetId}/status`, { isActive });
      setRows((current) => current.map((item) => String(item._id || item.id) === targetId ? { ...item, ...data.user, _id: item._id || data.user.id } : item));
      setNotice(data.message || `User ${isActive ? "activated" : "deactivated"}.`);
    } catch (requestError) {
      const status = requestError.response?.status;
      setStatusError(status === 400
        ? "That status change isn't valid. Admins cannot deactivate their own account."
        : status === 404
          ? "That user could not be found. Refresh the user list and try again."
          : "We couldn't update this account. Please try again.");
    } finally {
      setBusyUserId("");
    }
  }

  if (!isAdmin) {
    return (
      <section className="admin-access-denied" role="alert">
        <span className="admin-eyebrow">403 · ACCESS DENIED</span>
        <h1>Admin access required</h1>
        <p>Your account does not have permission to view this dashboard.</p>
        <Link className="admin-primary-button" to="/dashboard">Return to dashboard</Link>
      </section>
    );
  }

  const isOverview = activeSection === "overview";
  const sectionTitle = sections.find((section) => section.id === activeSection)?.label || "Overview";

  function sectionContent() {
    if (loading) return <div className="admin-loading"><span className="loading-spinner" />Loading {sectionTitle.toLowerCase()}…</div>;
    if (error) return <div className="admin-message admin-error" role="alert">{error} <button type="button" className="admin-text-button" onClick={refresh}>Retry</button></div>;

    if (activeSection === "users") {
      return <>
        {statusError && <div className="admin-message admin-error" role="alert">{statusError}</div>}
        {notice && <div className="admin-message admin-success" role="status">{notice}</div>}
        <DataTable emptyMessage="No users found." rows={rows} columns={[
          { label: "Name", render: (row) => row.name || "—" },
          { label: "Email", render: (row) => row.email || "—" },
          { label: "Role", render: (row) => <StatusBadge>{row.role || "rider"}</StatusBadge> },
          { label: "Account status", render: (row) => <StatusBadge tone={row.isActive === false ? "danger" : "success"}>{row.isActive === false ? "Inactive" : "Active"}</StatusBadge> },
          { label: "Created", render: (row) => formatDate(row.createdAt) },
          { label: "Actions", render: (row) => {
            const id = String(row._id || row.id || "");
            const self = id === String(user.id || user._id || "");
            const active = row.isActive !== false;
            return <button className={`admin-action-button${active ? " admin-action-danger" : ""}`} type="button" disabled={busyUserId === id || (self && active)} title={self && active ? "You cannot deactivate your own account" : ""} onClick={() => updateUserStatus(row, !active)}>{busyUserId === id ? "Saving…" : active ? "Deactivate" : "Activate"}</button>;
          } }
        ]} />
      </>;
    }

    if (activeSection === "rides") return <DataTable emptyMessage="No rides found." rows={rows} columns={[
      { label: "Route", render: (row) => <strong>{row.pickup || "—"} → {row.destination || "—"}</strong> },
      { label: "Date / time", render: (row) => `${formatDate(row.date)} · ${row.time || "—"}` },
      { label: "Driver", render: (row) => personName(row.driver) },
      { label: "Vehicle", render: (row) => [row.vehicle?.make, row.vehicle?.model].filter(Boolean).join(" ") || "—" },
      { label: "Seats", render: (row) => row.availableSeats ?? "—" },
      { label: "Price", render: (row) => formatMoney(row.price) },
      { label: "Status", render: (row) => <StatusBadge tone={row.status === "cancelled" ? "danger" : "success"}>{row.status || "—"}</StatusBadge> }
    ]} />;

    if (activeSection === "bookings") return <DataTable emptyMessage="No bookings found." rows={rows} columns={[
      { label: "Rider", render: (row) => personName(row.passenger) },
      { label: "Ride", render: (row) => row.ride ? `${row.ride.pickup || "—"} → ${row.ride.destination || "—"}` : "—" },
      { label: "Seats", render: (row) => row.seatsBooked ?? "—" },
      { label: "Amount", render: (row) => formatMoney(row.totalPrice) },
      { label: "Booking", render: (row) => <StatusBadge tone={row.status === "cancelled" ? "danger" : "success"}>{row.status || "—"}</StatusBadge> },
      { label: "Payment", render: (row) => {
        const payment = paymentsByBooking.get(String(row._id));
        return payment ? <StatusBadge tone={payment.status === "captured" || payment.status === "paid" ? "success" : "neutral"}>{payment.status}</StatusBadge> : "—";
      } }
    ]} />;

    if (activeSection === "payments") return <DataTable emptyMessage="No payments found." rows={rows} columns={[
      { label: "Amount", render: (row) => formatMoney(Number(row.amountPaise) / 100, row.currency || "INR") },
      { label: "Provider", render: (row) => row.provider || "—" },
      { label: "Order ID", render: (row) => <span className="admin-mono">{row.orderId || "—"}</span> },
      { label: "Payment ID", render: (row) => <span className="admin-mono">{row.paymentId || "—"}</span> },
      { label: "Status", render: (row) => <StatusBadge tone={row.status === "captured" || row.status === "paid" ? "success" : "neutral"}>{row.status || "—"}</StatusBadge> },
      { label: "Created", render: (row) => formatDate(row.createdAt) }
    ]} />;

    if (activeSection === "vehicles") return <DataTable emptyMessage="No vehicles found." rows={rows} columns={[
      { label: "Owner", render: (row) => personName(row.owner) },
      { label: "Vehicle", render: (row) => <strong>{[row.make, row.model].filter(Boolean).join(" ") || "—"}</strong> },
      { label: "Registration", render: (row) => row.registrationNumber || "—" },
      { label: "Battery", render: (row) => row.batteryPercentage == null ? "—" : `${row.batteryPercentage}%` },
      { label: "Range", render: (row) => row.estimatedRange == null ? "—" : `${row.estimatedRange} km` },
      { label: "Charging status", render: (row) => <StatusBadge>{(row.chargingStatus || "—").replaceAll("_", " ")}</StatusBadge> }
    ]} />;

    return <DataTable emptyMessage="No charging stations found." rows={rows} columns={[
      { label: "Station", render: (row) => <strong>{row.name || "—"}</strong> },
      { label: "Address", render: (row) => row.address || "—" },
      { label: "City", render: (row) => row.city || "—" },
      { label: "Charger", render: (row) => row.chargerType || "—" },
      { label: "Slots", render: (row) => `${row.availableSlots ?? "—"} / ${row.totalSlots ?? "—"}` },
      { label: "Price", render: (row) => row.chargingPrice == null ? "—" : `${formatMoney(row.chargingPrice)} / unit` },
      { label: "Status", render: (row) => <StatusBadge tone={row.status === "active" ? "success" : "neutral"}>{row.status || "—"}</StatusBadge> }
    ]} />;
  }

  return (
    <div className="admin-page">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow"><span className="live-dot" /> PLATFORM CONTROL CENTER</span>
          <h1>Admin Dashboard</h1>
          <p>Manage platform activity and review EVRide operations.</p>
          <span className="admin-email">Signed in as <strong>{user.email}</strong></span>
        </div>
        <div className="admin-heading-actions">
          <button className="admin-secondary-button" type="button" onClick={refresh} disabled={loading || statsLoading}>↻ Refresh</button>
          <button className="admin-primary-button" type="button" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        {sections.map((section) => <button key={section.id} type="button" className={activeSection === section.id ? "admin-tab active" : "admin-tab"} aria-current={activeSection === section.id ? "page" : undefined} onClick={() => { setNotice(""); setStatusError(""); setActiveSection(section.id); }}>{section.label}</button>)}
      </nav>

      {isOverview ? (
        <section className="admin-overview" aria-labelledby="admin-stats-title">
          <div className="admin-section-heading"><div><span className="admin-eyebrow">PLATFORM OVERVIEW</span><h2 id="admin-stats-title">Key statistics</h2></div></div>
          {statsError && <div className="admin-message admin-error" role="alert">{statsError} <button type="button" className="admin-text-button" onClick={refresh}>Retry</button></div>}
          {statsLoading && !stats && <div className="admin-loading"><span className="loading-spinner" />Loading platform statistics…</div>}
          {!statsLoading && !statsError && !stats && <div className="admin-empty">Statistics are unavailable.</div>}
          {stats && <div className="admin-stats-grid">{statCards.map(([key, label, icon]) => <article className="admin-stat-card" key={key}><span className={`admin-stat-icon admin-icon-${icon}`} aria-hidden="true">{label.slice(0, 1)}</span><div><span>{label}</span><strong>{stats[key] ?? 0}</strong></div></article>)}</div>}
          <div className="admin-overview-note"><span className="admin-note-mark">EV</span><p><strong>Platform operations</strong><br />Review users, rides, bookings, payments, EVs, and charging locations from the tabs above.</p></div>
        </section>
      ) : (
        <section className="admin-section" aria-labelledby="admin-section-title">
          <div className="admin-section-heading"><div><span className="admin-eyebrow">PLATFORM RECORDS</span><h2 id="admin-section-title">{sectionTitle}</h2></div><span className="admin-record-count">{!loading && !error ? `${rows.length} records` : ""}</span></div>
          {sectionContent()}
        </section>
      )}
    </div>
  );
}
