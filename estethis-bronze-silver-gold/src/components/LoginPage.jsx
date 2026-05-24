// ─────────────────────────────────────────────────────────────
// LOGIN PAGE — three authentication methods
//
//  Tab 1: Password    (email + password)
//  Tab 2: OTP         (email or phone → 6-digit code)
//  Tab 3: Magic Link  (email → single-use link)
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { OrnamentIcon } from "./Shared";
import {
  apiLogin,
  apiRequestOtp, apiLoginWithOtp,
  apiRequestMagicLink, apiVerifyMagicLink,
} from "../data/api";

const RACK_IMG =
  "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=80";

const TABS = ["Password", "OTP", "Magic Link"];

// ── Tab 1: Password ───────────────────────────────────────────
function PasswordForm({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async (e) => {
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
    <>
      <label className="auth-label">E-MAIL ADDRESS</label>
      <input className="auth-input" type="email" value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="your@email.com" autoComplete="email" />

      <label className="auth-label">PASSWORD</label>
      <input className="auth-input" type="password" value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="••••••••" autoComplete="current-password" />

      {error && <p className="auth-error">{error}</p>}

      <button className={`auth-btn ${loading ? "auth-btn--loading" : ""}`}
        onClick={submit} disabled={loading}>
        {loading ? "SIGNING IN…" : "LOGIN"}
      </button>
    </>
  );
}

// ── Tab 2: OTP ────────────────────────────────────────────────
function OtpForm({ onLogin }) {
  const [step,       setStep]       = useState("request"); // 'request' | 'verify'
  const [identifier, setIdentifier] = useState("");
  const [code,       setCode]       = useState("");
  const [demoOtp,    setDemoOtp]    = useState("");
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);

  const requestOtp = async () => {
    if (!identifier.trim()) { setError("Enter your email or phone number."); return; }
    setError(""); setLoading(true);
    try {
      const data = await apiRequestOtp(identifier.trim());
      setDemoOtp(data._demo_otp || "");
      setStep("verify");
    } catch (err) {
      setError(err.message || "Could not send OTP.");
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (!code.trim()) { setError("Enter the 6-digit code."); return; }
    setError(""); setLoading(true);
    try {
      const { user } = await apiLoginWithOtp(identifier.trim(), code.trim());
      onLogin(user);
    } catch (err) {
      setError(err.message || "Invalid or expired OTP.");
    } finally { setLoading(false); }
  };

  if (step === "request") return (
    <>
      <label className="auth-label">EMAIL OR PHONE</label>
      <input className="auth-input" type="text" value={identifier}
        onChange={e => setIdentifier(e.target.value)}
        onKeyDown={e => e.key === "Enter" && requestOtp()}
        placeholder="your@email.com or +40700..." />
      {error && <p className="auth-error">{error}</p>}
      <button className={`auth-btn ${loading ? "auth-btn--loading" : ""}`}
        onClick={requestOtp} disabled={loading}>
        {loading ? "SENDING…" : "SEND OTP"}
      </button>
    </>
  );

  return (
    <>
      <label className="auth-label">6-DIGIT CODE</label>
      <input className="auth-input" type="text" inputMode="numeric"
        maxLength={6} value={code}
        onChange={e => setCode(e.target.value)}
        onKeyDown={e => e.key === "Enter" && verifyOtp()}
        placeholder="123456" autoComplete="one-time-code" />
      {demoOtp && (
        <p className="auth-info">
          Demo OTP: <strong style={{letterSpacing:"0.2em"}}>{demoOtp}</strong>
        </p>
      )}
      {error && <p className="auth-error">{error}</p>}
      <button className={`auth-btn ${loading ? "auth-btn--loading" : ""}`}
        onClick={verifyOtp} disabled={loading}>
        {loading ? "VERIFYING…" : "VERIFY CODE"}
      </button>
      <button className="auth-forgot" onClick={() => { setStep("request"); setCode(""); setError(""); }}>
        ← CHANGE IDENTIFIER
      </button>
    </>
  );
}

// ── Tab 3: Magic Link ─────────────────────────────────────────
function MagicLinkForm({ onLogin }) {
  const [step,      setStep]      = useState("request"); // 'request' | 'verify' | 'done'
  const [email,     setEmail]     = useState("");
  const [token,     setToken]     = useState("");
  const [demoToken, setDemoToken] = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);

  const request = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address."); return;
    }
    setError(""); setLoading(true);
    try {
      const data = await apiRequestMagicLink(email.trim());
      setDemoToken(data._demo_token || "");
      setStep("verify");
    } catch (err) {
      setError(err.message || "Could not send magic link.");
    } finally { setLoading(false); }
  };

  const verify = async () => {
    if (!token.trim()) { setError("Paste the token from the magic link."); return; }
    setError(""); setLoading(true);
    try {
      const { user } = await apiVerifyMagicLink(token.trim());
      onLogin(user);
    } catch (err) {
      setError(err.message || "Invalid or expired magic link.");
    } finally { setLoading(false); }
  };

  if (step === "request") return (
    <>
      <p className="auth-info" style={{marginBottom:8}}>
        We'll send a one-time link to your email — no password needed.
      </p>
      <label className="auth-label">E-MAIL ADDRESS</label>
      <input className="auth-input" type="email" value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === "Enter" && request()}
        placeholder="your@email.com" autoComplete="email" />
      {error && <p className="auth-error">{error}</p>}
      <button className={`auth-btn ${loading ? "auth-btn--loading" : ""}`}
        onClick={request} disabled={loading}>
        {loading ? "SENDING…" : "SEND MAGIC LINK"}
      </button>
    </>
  );

  return (
    <>
      {demoToken && (
        <p className="auth-info">
          Demo token (paste below):<br />
          <strong style={{fontSize:"0.7rem",wordBreak:"break-all"}}>{demoToken}</strong>
        </p>
      )}
      <label className="auth-label">PASTE TOKEN</label>
      <input className="auth-input" type="text" value={token}
        onChange={e => setToken(e.target.value)}
        onKeyDown={e => e.key === "Enter" && verify()}
        placeholder="Paste the token from the link" />
      {error && <p className="auth-error">{error}</p>}
      <button className={`auth-btn ${loading ? "auth-btn--loading" : ""}`}
        onClick={verify} disabled={loading}>
        {loading ? "VERIFYING…" : "SIGN IN"}
      </button>
      <button className="auth-forgot"
        onClick={() => { setStep("request"); setToken(""); setError(""); }}>
        ← TRY ANOTHER EMAIL
      </button>
    </>
  );
}

// ── Main component ────────────────────────────────────────────
export default function LoginPage({ onLogin, onRegister, onForgotPassword }) {
  const [tab, setTab] = useState(0);

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

          {/* Tab switcher */}
          <div className="auth-tabs">
            {TABS.map((t, i) => (
              <button key={t}
                className={`auth-tab ${tab === i ? "auth-tab--active" : ""}`}
                onClick={() => setTab(i)}>
                {t}
              </button>
            ))}
          </div>

          <div className="auth-form">
            {tab === 0 && <PasswordForm onLogin={onLogin} />}
            {tab === 1 && <OtpForm      onLogin={onLogin} />}
            {tab === 2 && <MagicLinkForm onLogin={onLogin} />}

            {tab === 0 && (
              <button className="auth-forgot" onClick={onForgotPassword}>
                FORGOT PASSWORD?
              </button>
            )}

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
      <div className="auth-right" style={{ backgroundImage: `url(${RACK_IMG})` }} />
    </div>
  );
}
