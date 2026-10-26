import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiError } from "../utils/errors.js";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const { name, email, phone, password } = form;
      await register({ name, email, phone, password });
      navigate("/login", { replace: true, state: { notice: "Your account is ready. Sign in to continue." } });
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't create your account. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card-wrap register-card">
      <div className="auth-heading">
        <span className="eyebrow eyebrow-dark">GET STARTED</span>
        <h2>Make room to move.</h2>
        <p>Create your account and get your next trip in motion.</p>
      </div>
      {error && <div className="error-message" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="register-name">Full name</label>
        <input id="register-name" name="name" type="text" autoComplete="name" placeholder="Your name" value={form.name} onChange={update} maxLength={80} required />
        <label htmlFor="register-email">Email address</label>
        <input id="register-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update} required />
        <label htmlFor="register-phone">Phone <span className="optional-label">Optional</span></label>
        <input id="register-phone" name="phone" type="tel" autoComplete="tel" placeholder="Your phone number" value={form.phone} onChange={update} />
        <label htmlFor="register-password">Password</label>
        <input id="register-password" name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={form.password} onChange={update} minLength={6} required />
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}<span aria-hidden="true">→</span>
        </button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </div>
  );
}
