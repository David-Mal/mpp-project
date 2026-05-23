// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// Small reusable pieces used across multiple pages.
// ─────────────────────────────────────────────────────────────

import "../styles/components.css";

/** Estethis logotype + tagline */
export function Logo({ onClick }) {
  return (
    <div className="logo" onClick={onClick}>
      <div className="logo__name">Estethis</div>
      <div className="logo__tagline">ELEVATE YOUR WARDROBE</div>
    </div>
  );
}

/** Horizontal gold fade line */
export function GoldDivider({ width = 48, style = {} }) {
  return (
    <div
      className="gold-divider"
      style={{ width, ...style }}
    />
  );
}

/** Decorative ornament SVG used above form titles */
export function OrnamentIcon() {
  return (
    <svg
      width="80" height="20" viewBox="0 0 80 20"
      fill="none" style={{ display: "block", margin: "0 auto 8px" }}
    >
      <path
        d="M40 10 C30 4, 15 4, 5 10 C15 16, 30 16, 40 10Z"
        stroke="#c9a84c" strokeWidth="0.8" fill="none" opacity="0.8"
      />
      <path
        d="M40 10 C50 4, 65 4, 75 10 C65 16, 50 16, 40 10Z"
        stroke="#c9a84c" strokeWidth="0.8" fill="none" opacity="0.8"
      />
      <circle cx="40" cy="10" r="2" fill="#c9a84c" opacity="0.9" />
    </svg>
  );
}

/** Slide-in notification at bottom-right */
export function Toast({ message, type, onClose }) {
  const borderColor = type === "danger" ? "#c05050" : "#c9a84c";
  const borderSide  = type === "danger"
    ? "1px solid rgba(192,80,80,0.4)"
    : "1px solid rgba(201,168,76,0.25)";

  return (
    <div
      className="toast"
      style={{ borderLeftColor: borderColor, border: borderSide, borderLeft: `3px solid ${borderColor}` }}
    >
      <span>{message}</span>
      <button className="toast__close" onClick={onClose}>×</button>
    </div>
  );
}
