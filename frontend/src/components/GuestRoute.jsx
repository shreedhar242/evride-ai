import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader">Loading EVRide AI…</div>;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
