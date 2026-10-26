import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiError } from "../utils/errors.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't sign you in. Check your details and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card-wrap">
      <div className="auth-heading">
        <span className="eyebrow eyebrow-dark">WELCOME BACK</span>
        <h2>Good to see you.</h2>
        <p>Sign in to pick up where your journey left off.</p>
      </div>
      {location.state?.notice && <div className="notice-message" role="status">{location.state.notice}</div>}
      {error && <div className="error-message" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Email address</label>
        <input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update} required />
        <div className="label-row"><label htmlFor="login-password">Password</label></div>
        <input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={update} required />
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span>
        </button>
      </form>
      <p className="auth-switch">New to EVRide AI? <Link to="/register">Create an account</Link></p>
    </div>
  );
}
