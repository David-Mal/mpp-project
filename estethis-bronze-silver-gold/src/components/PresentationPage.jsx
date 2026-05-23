// ─────────────────────────────────────────────────────────────
// PRESENTATION PAGE
// The landing page — split dark/cream layout with logo,
// tagline, description, CTA, and the three pillars section.
// ─────────────────────────────────────────────────────────────

import { GoldDivider } from "./Shared";
import "../styles/components.css";

const PILLARS = [
  {
    num: "01",
    title: "CURATED COLLECTIONS",
    desc: "Handpicked pieces from the finest ateliers, updated each season.",
  },
  {
    num: "02",
    title: "BESPOKE TAILORING",
    desc: "Every piece adjusted to your exact measurements, in-house.",
  },
  {
    num: "03",
    title: "LUXURY EXPERIENCE",
    desc: "From browse to delivery — a seamless, refined journey.",
  },
];

export default function PresentationPage({ onEnter }) {
  return (
    <div className="presentation page-enter">

      {/* ── LEFT: dark panel ── */}
      <div className="presentation__left">
        <div className="corner corner--tl" />
        <div className="corner corner--bl" />

        <div className="presentation__left-content">
          <p className="presentation__eyebrow">EST. 2024 · LUXURY FASHION</p>

          <h1 className="presentation__title">Estethis</h1>

          <p className="presentation__tagline">ELEVATE YOUR WARDROBE</p>

          <GoldDivider />

          <p className="presentation__description">
            A curated luxury fashion destination where timeless elegance meets
            modern style. Exclusive collections crafted for those who value
            refinement.
          </p>

          <button className="presentation__cta" onClick={onEnter}>
            EXPLORE COLLECTION
          </button>
        </div>
      </div>

      {/* ── RIGHT: cream panel ── */}
      <div className="presentation__right">
        <div className="corner corner--tr" />
        <div className="corner corner--br" />

        <p className="presentation__section-label">WHAT WE OFFER</p>

        <h2 className="presentation__heading">
          Three Pillars<br />of<br />Excellence
        </h2>

        <GoldDivider style={{ marginBottom: 36 }} />

        {PILLARS.map((p) => (
          <div className="pillar" key={p.num}>
            <div className="pillar__number">{p.num}</div>
            <div>
              <p className="pillar__title">{p.title}</p>
              <p className="pillar__desc">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
