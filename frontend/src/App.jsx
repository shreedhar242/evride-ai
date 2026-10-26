import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import AuthLayout from "./layouts/AuthLayout.jsx";
import GuestRoute from "./components/GuestRoute.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import RideSearch from "./pages/RideSearch.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import MyVehicles from "./pages/MyVehicles.jsx";
import ChargingStations from "./pages/ChargingStations.jsx";
import Recommendations from "./pages/Recommendations.jsx";
import MyRides from "./pages/MyRides.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rides" element={<RideSearch />} />
          <Route path="/bookings" element={<MyBookings />} />
          <Route path="/vehicles" element={<MyVehicles />} />
          <Route path="/charging-stations" element={<ChargingStations />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/my-rides" element={<MyRides />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
