// ─────────────────────────────────────────────────────────────
// REGISTER PAGE
// Same split layout as Login. Phone / email / password / confirm.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { OrnamentIcon } from "./Shared";
import { apiRegister } from "../data/api";

const RACK_IMG =
  "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=80";

export default function RegisterPage({ onRegister, onLogin }) {
  const [form,    setForm]    = useState({ phone: "", email: "", password: "", confirm: "" });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.phone.trim())    errs.phone    = "Phone required.";
    if (!form.email.includes("@")) errs.email = "Valid email required.";
    if (form.password.length < 6)  errs.password = "Min 6 characters.";
    if (form.password !== form.confirm) errs.confirm = "Passwords don't match.";
    return errs;
  };

  const [serverError, setServerError] = useState("");

  const handleSubmit = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setServerError("");
    setLoading(true);
    try {
      const { user } = await apiRegister(form.email.trim(), form.phone.trim(), form.password);
      onRegister(user);
    } catch (err) {
      setServerError(err.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page page-enter">
      {/* ── LEFT: dark form panel ── */}
      <div className="auth-left">
        <div className="corner corner--tl" />
        <div className="corner corner--bl" />

        <div className="auth-left-content">
          <OrnamentIcon />
          <h1 className="auth-brand">Estethis</h1>
          <p className="auth-tagline">ELEVATE YOUR WARDROBE</p>

          <div className="auth-form">
            <label className="auth-label">PHONE NUMBER</label>
            <input
              className={`auth-input ${errors.phone ? "auth-input--error" : ""}`}
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+40 700 000 000"
            />
            {errors.phone && <p className="auth-error">{errors.phone}</p>}

            <label className="auth-label">E-MAIL ADDRESS</label>
            <input
              className={`auth-input ${errors.email ? "auth-input--error" : ""}`}
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="your@email.com"
            />
            {errors.email && <p className="auth-error">{errors.email}</p>}

            <label className="auth-label">PASSWORD</label>
            <input
              className={`auth-input ${errors.password ? "auth-input--error" : ""}`}
              type="password"
              value={form.password}
              onChange={set("password")}
              placeholder="Min 6 characters"
            />
            {errors.password && <p className="auth-error">{errors.password}</p>}

            <label className="auth-label">CONFIRM</label>
            <input
              className={`auth-input ${errors.confirm ? "auth-input--error" : ""}`}
              type="password"
              value={form.confirm}
              onChange={set("confirm")}
              placeholder="Repeat password"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            {errors.confirm && <p className="auth-error">{errors.confirm}</p>}

            {serverError && <p className="auth-error">{serverError}</p>}

            <button
              className={`auth-btn ${loading ? "auth-btn--loading" : ""}`}
              onClick={handleSubmit}
              disabled={loading}
              style={{ marginTop: 16 }}
            >
              {loading ? "CREATING ACCOUNT…" : "SIGN UP"}
            </button>

            <p className="auth-switch">
              ALREADY A MEMBER?{" "}
              <button className="auth-switch-link" onClick={onLogin}>
                LOGIN
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT: image panel ── */}
      <div
        className="auth-right"
        style={{ backgroundImage: `url(${RACK_IMG})` }}
      />
    </div>
  );
}
