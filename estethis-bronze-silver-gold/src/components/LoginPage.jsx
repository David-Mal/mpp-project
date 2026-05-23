// ─────────────────────────────────────────────────────────────
// LOGIN PAGE
// Split layout: left = dark panel with form, right = clothing
// rack image. Transitions to Landing page on success.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { OrnamentIcon } from "./Shared";
import { apiLogin } from "../data/api";

const RACK_IMG =
  "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=80";

export default function LoginPage({ onLogin, onRegister }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { user } = await apiLogin(email.trim(), password);
      onLogin(user);
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
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
            <label className="auth-label">E-MAIL ADDRESS</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="your@email.com"
              autoComplete="email"
            />

            <label className="auth-label">PASSWORD</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            <button
              className="auth-forgot"
              onClick={() => {}}
            >
              FORGOT PASSWORD?
            </button>

            {error && <p className="auth-error">{error}</p>}

            <button
              className={`auth-btn ${loading ? "auth-btn--loading" : ""}`}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "SIGNING IN…" : "LOGIN"}
            </button>

            <p className="auth-switch">
              NOT A MEMBER{" "}
              <button className="auth-switch-link" onClick={onRegister}>
                REGISTER NOW
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
