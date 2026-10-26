import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPage = location.pathname === "/admin";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand-link" to="/dashboard" aria-label="EVRide AI dashboard"><Brand /></NavLink>
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink className={({ isActive }) => `nav-dashboard${isActive ? " is-active" : ""}`} to="/dashboard">Dashboard</NavLink>
          <NavLink className={({ isActive }) => `nav-dashboard${isActive ? " is-active" : ""}`} to="/rides">Find Rides</NavLink>
          <NavLink className={({ isActive }) => `nav-dashboard${isActive ? " is-active" : ""}`} to="/my-rides">My Rides</NavLink>
          <NavLink className={({ isActive }) => `nav-dashboard${isActive ? " is-active" : ""}`} to="/bookings">My Bookings</NavLink>
          <NavLink className={({ isActive }) => `nav-dashboard${isActive ? " is-active" : ""}`} to="/vehicles">My Vehicles</NavLink>
          <NavLink className={({ isActive }) => `nav-dashboard${isActive ? " is-active" : ""}`} to="/charging-stations">Charging Stations</NavLink>
          <NavLink className={({ isActive }) => `nav-dashboard${isActive ? " is-active" : ""}`} to="/recommendations">AI Recommendations</NavLink>
          {user?.role === "admin" && <NavLink className={({ isActive }) => `nav-dashboard${isActive ? " is-active" : ""}`} to="/admin">Admin</NavLink>}
          {user?.role === "admin" && <NavLink className={({ isActive }) => `nav-dashboard${isActive ? " is-active" : ""}`} to="/admin">Admin</NavLink>}
        </nav>
        {!isAdminPage && <div className="topbar-actions">
          <span className="user-chip"><span className="user-avatar">{user?.name?.charAt(0)?.toUpperCase() || "E"}</span><span className="user-name">{user?.role === "admin" ? user?.email : user?.name}</span></span>
          <button className="logout-button" type="button" onClick={handleLogout}>Log out <span aria-hidden="true">↗</span></button>
        </div>}
      </header>
      <main className="app-content"><Outlet /></main>
      <footer className="app-footer"><span>EVRide AI</span><span>Move well. Move electric.</span></footer>
    </div>
  );
}
