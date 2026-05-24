// ─────────────────────────────────────────────────────────────
// FORGOT PASSWORD PAGE — two-step password recovery
//
//  Step 1: Enter email → receive reset token (demo: shown inline)
//  Step 2: Paste token + choose new password → password updated
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { OrnamentIcon } from "./Shared";
import { apiForgotPassword, apiResetPassword } from "../data/api";

const RACK_IMG =
  "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=80";

export default function ForgotPasswordPage({ onBack }) {
  const [step,        setStep]        = useState("request"); // 'request' | 'reset' | 'done'
  const [email,       setEmail]       = useState("");
  const [demoToken,   setDemoToken]   = useState("");
  const [token,       setToken]       = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  // ── Step 1: request reset token ───────────────────────────
  const handleRequest = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address."); return;
    }
    setError(""); setLoading(true);
    try {
      const data = await apiForgotPassword(email.trim());
      if (data._demo_token) setDemoToken(data._demo_token);
      setStep("reset");
    } catch (err) {
      setError(err.message || "Could not send reset token.");
    } finally { setLoading(false); }
  };

  // ── Step 2: submit new password ───────────────────────────
  const handleReset = async () => {
    if (!token.trim()) { setError("Paste the reset token."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirm) { setError("Passwords do not match."); return; }
    setError(""); setLoading(true);
    try {
      await apiResetPassword(token.trim(), newPassword);
      setStep("done");
    } catch (err) {
      setError(err.message || "Could not reset password. Token may have expired.");
    } finally { setLoading(false); }
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
          <p className="auth-tagline">PASSWORD RECOVERY</p>

          <div className="auth-form">

            {/* ── Step 1: request ── */}
            {step === "request" && (
              <>
                <p className="auth-info">
                  Enter your account email. We'll generate a reset token.
                </p>
                <label className="auth-label">E-MAIL ADDRESS</label>
                <input className="auth-input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRequest()}
                  placeholder="your@email.com" autoComplete="email" />

                {error && <p className="auth-error">{error}</p>}

                <button
                  className={`auth-btn ${loading ? "auth-btn--loading" : ""}`}
                  onClick={handleRequest} disabled={loading}>
                  {loading ? "SENDING…" : "SEND RESET TOKEN"}
                </button>

                <button className="auth-forgot" onClick={onBack}>
                  ← BACK TO LOGIN
                </button>
              </>
            )}

            {/* ── Step 2: reset ── */}
            {step === "reset" && (
              <>
                {demoToken && (
                  <div className="auth-info" style={{marginBottom:12}}>
                    <strong>Demo reset token</strong> (in production this would
                    arrive by email):
                    <br />
                    <span style={{
                      display:"block", marginTop:6,
                      fontFamily:"monospace", fontSize:"0.72rem",
                      wordBreak:"break-all", color:"#c8b89a",
                    }}>
                      {demoToken}
                    </span>
                  </div>
                )}

                <label className="auth-label">RESET TOKEN</label>
                <input className="auth-input" type="text" value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Paste token here" />

                <label className="auth-label">NEW PASSWORD</label>
                <input className="auth-input" type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleReset()}
                  placeholder="Min 6 characters" />

                <label className="auth-label">CONFIRM PASSWORD</label>
                <input className="auth-input" type="password" value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleReset()}
                  placeholder="Repeat password" />

                {error && <p className="auth-error">{error}</p>}

                <button
                  className={`auth-btn ${loading ? "auth-btn--loading" : ""}`}
                  onClick={handleReset} disabled={loading}>
                  {loading ? "UPDATING…" : "SET NEW PASSWORD"}
                </button>

                <button className="auth-forgot"
                  onClick={() => { setStep("request"); setToken(""); setError(""); }}>
                  ← BACK
                </button>
              </>
            )}

            {/* ── Step 3: done ── */}
            {step === "done" && (
              <>
                <p className="auth-info" style={{color:"#8fc98f", marginBottom:20}}>
                  ✓ Password updated successfully.
                </p>
                <button className="auth-btn" onClick={onBack}>
                  GO TO LOGIN
                </button>
              </>
            )}

          </div>
        </div>
      </div>

      {/* ── RIGHT: image panel ── */}
      <div className="auth-right" style={{ backgroundImage: `url(${RACK_IMG})` }} />
    </div>
  );
}
