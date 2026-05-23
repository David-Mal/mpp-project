// ─────────────────────────────────────────────────────────────
// ATELIER MODE — Bespoke Tailoring Configurator
// 3-step wizard: Select Product → Mark & Measure → Confirm & Send
// ─────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { Logo, GoldDivider } from "./Shared";

const MEASUREMENT_POINTS = [
  { id: "shoulder", label: "Shoulder", cx: 58,  cy: 32,  field: "shoulder",  placeholder: "e.g. 38" },
  { id: "chest",    label: "Chest",    cx: 50,  cy: 45,  field: "chest",     placeholder: "e.g. 86" },
  { id: "sleeve",   label: "Sleeve",   cx: 30,  cy: 52,  field: "sleeve",    placeholder: "e.g. 62" },
  { id: "waist",    label: "Waist",    cx: 50,  cy: 60,  field: "waist",     placeholder: "e.g. 68" },
  { id: "length",   label: "Length",   cx: 50,  cy: 82,  field: "length",    placeholder: "e.g. 65" },
];

const SIZES = ["XS", "S", "M", "L", "XL"];

// ── SVG human silhouette ───────────────────────────────────────
function BodySVG({ selected, onSelect }) {
  return (
    <svg viewBox="0 0 100 110" style={{ width: "100%", maxWidth: 340, display: "block", margin: "0 auto" }}>
      {/* Head */}
      <ellipse cx="50" cy="12" rx="10" ry="12"
        fill="none" stroke="rgba(201,168,76,0.25)" strokeWidth="1" />
      {/* Neck */}
      <rect x="46" y="23" width="8" height="6"
        fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="1" />
      {/* Torso */}
      <path d="M32 29 Q28 32 26 38 L24 70 L76 70 L74 38 Q72 32 68 29 Z"
        fill="none" stroke="rgba(201,168,76,0.22)" strokeWidth="1" />
      {/* Left arm */}
      <path d="M32 30 Q22 35 20 50 Q19 58 22 64 Q24 66 26 64 Q28 58 30 50 L32 38"
        fill="none" stroke="rgba(201,168,76,0.18)" strokeWidth="1" />
      {/* Right arm */}
      <path d="M68 30 Q78 35 80 50 Q81 58 78 64 Q76 66 74 64 Q72 58 70 50 L68 38"
        fill="none" stroke="rgba(201,168,76,0.18)" strokeWidth="1" />
      {/* Left leg */}
      <path d="M38 70 L34 100 Q33 104 38 104 Q41 104 42 100 L44 70"
        fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="1" />
      {/* Right leg */}
      <path d="M62 70 L66 100 Q67 104 62 104 Q59 104 58 100 L56 70"
        fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="1" />

      {/* Measurement point dots */}
      {MEASUREMENT_POINTS.map(pt => {
        const isSelected = selected === pt.id;
        return (
          <g key={pt.id} style={{ cursor: "pointer" }} onClick={() => onSelect(pt.id)}>
            <circle cx={pt.cx} cy={pt.cy} r="5" fill="transparent" />
            <circle cx={pt.cx} cy={pt.cy} r={isSelected ? 4 : 3}
              fill={isSelected ? "#c9a84c" : "transparent"}
              stroke={isSelected ? "#c9a84c" : "rgba(201,168,76,0.45)"}
              strokeWidth="1.5"
              style={{ transition: "all 0.2s" }}
            />
            <text x={pt.cx + 7} y={pt.cy + 4} fontSize="5"
              fill={isSelected ? "#c9a84c" : "rgba(201,168,76,0.4)"}
              fontFamily="Montserrat,sans-serif" letterSpacing="0.5">
              {pt.label}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <text x="50" y="108" textAnchor="middle" fontSize="4.5"
        fill="rgba(201,168,76,0.3)" fontFamily="Montserrat,sans-serif" letterSpacing="1">
        GOLD = SELECTED · GRAY = AVAILABLE
      </text>
    </svg>
  );
}

// ── Step indicator ─────────────────────────────────────────────
function StepBar({ step }) {
  const steps = ["SELECT PRODUCT", "MARK & MEASURE", "CONFIRM & SEND"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              border: `1px solid ${i < step ? "#c9a84c" : i === step - 1 ? "#c9a84c" : "rgba(201,168,76,0.3)"}`,
              background: i === step - 1 ? "transparent" : i < step - 1 ? "rgba(201,168,76,0.2)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Montserrat,sans-serif", fontSize: 11,
              color: i <= step - 1 ? "#c9a84c" : "rgba(201,168,76,0.3)",
              transition: "all 0.3s",
            }}>{i + 1}</div>
            <span style={{
              fontFamily: "Montserrat,sans-serif", fontSize: 8, letterSpacing: "0.16em",
              color: i === step - 1 ? "#c9a84c" : "rgba(201,168,76,0.3)",
              display: window.innerWidth > 600 ? "inline" : "none",
            }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              width: 40, height: 1, margin: "0 10px",
              background: i < step - 1 ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.15)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function AtelierMode({ products, onBack }) {
  const [step, setStep]             = useState(1);
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? null);
  const [selectedPt, setSelectedPt] = useState("shoulder");
  const [size, setSize]             = useState("M");
  const [addOns, setAddOns]         = useState({ rush: false, premium: false });
  const [measurements, setMeasurements] = useState({
    shoulder: "", chest: "", waist: "", sleeve: "", length: "",
  });
  const [notes, setNotes]   = useState("");
  const [sent,  setSent]    = useState(false);

  const selected = useMemo(() => products.find(p => p.id === selectedId), [products, selectedId]);
  const others   = useMemo(() => products.filter(p => p.id !== selectedId).slice(0, 3), [products, selectedId]);

  const tailorFee = 35 + (addOns.rush ? 15 : 0) + (addOns.premium ? 8 : 0);
  const total     = (selected?.price ?? 0) + tailorFee;

  const setM = (field, val) => setMeasurements(m => ({ ...m, [field]: val }));

  const activePt = MEASUREMENT_POINTS.find(p => p.id === selectedPt);

  // ── Step 3 send ────────────────────────────────────────────
  if (sent) {
    return (
      <div className="atelier-page page-enter">
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 24,
        }}>
          <div style={{ fontSize: 40, color: "#c9a84c" }}>✓</div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: "#f0ebe0" }}>
            Request Sent
          </h2>
          <p style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, letterSpacing: "0.2em",
            color: "rgba(240,235,224,0.4)", textAlign: "center" }}>
            OUR TAILOR WILL CONTACT YOU WITHIN 24 HOURS
          </p>
          <GoldDivider style={{ width: 80 }} />
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11,
            color: "rgba(240,235,224,0.55)", textAlign: "center", lineHeight: 2 }}>
            <div>{selected?.name}</div>
            <div>Est. ready in 7–10 days · Total ${total}</div>
          </div>
          <button className="auth-btn" style={{ width: 200, marginTop: 8 }} onClick={onBack}>
            BACK TO PRODUCTS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="atelier-page page-enter">
      {/* ── TOP NAV ── */}
      <div className="atelier-nav">
        <Logo onClick={onBack} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16,
            color: "#c9a84c", letterSpacing: "0.08em", marginBottom: 2 }}>
            Atelier Mode
          </div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 7,
            letterSpacing: "0.3em", color: "rgba(201,168,76,0.4)" }}>
            BESPOKE TAILORING CONFIGURATOR — SEND ANY PIECE TO OUR IN-HOUSE TAILOR
          </div>
        </div>
        <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 8,
          letterSpacing: "0.18em", color: "rgba(240,235,224,0.3)", alignSelf: "center" }}>
          STEP {step} OF 3 — {["SELECT PRODUCT","MARK MEASUREMENTS","CONFIRM & SEND"][step-1].toUpperCase()}
        </div>
      </div>
      <GoldDivider style={{ width: "100%" }} />

      {/* Step + step labels */}
      <div style={{ padding: "14px 32px", borderBottom: "1px solid rgba(201,168,76,0.1)", display: "flex", alignItems: "center", gap: 24 }}>
        <StepBar step={step} />
      </div>

      {/* ── STEP 1: SELECT PRODUCT ── */}
      {step === 1 && (
        <div className="atelier-body">
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 0" }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: "#f0ebe0",
              marginBottom: 8 }}>Select a product to tailor</h2>
            <p style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, letterSpacing: "0.15em",
              color: "rgba(240,235,224,0.35)", marginBottom: 28 }}>
              CHOOSE THE PIECE YOU WISH TO SEND TO OUR IN-HOUSE TAILOR
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {products.map(p => (
                <div key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "14px 18px", cursor: "pointer",
                    border: `1px solid ${selectedId === p.id ? "#c9a84c" : "rgba(201,168,76,0.15)"}`,
                    background: selectedId === p.id ? "rgba(201,168,76,0.07)" : "transparent",
                    transition: "all 0.2s",
                  }}>
                  {p.image && <img src={p.image} alt="" style={{
                    width: 52, height: 52, objectFit: "cover",
                    border: "1px solid rgba(201,168,76,0.2)", flexShrink: 0,
                  }} onError={e => { e.target.style.display="none"; }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15,
                      color: selectedId === p.id ? "#c9a84c" : "#f0ebe0" }}>{p.name}</div>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 9,
                      color: "rgba(240,235,224,0.35)", letterSpacing: "0.1em", marginTop: 3 }}>
                      {p.colors?.join(" / ")} · {p.sizes?.join(" / ")}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16,
                    color: selectedId === p.id ? "#c9a84c" : "rgba(240,235,224,0.6)" }}>
                    ${p.price}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
              <button className="auth-btn" style={{ width: 220 }}
                onClick={() => selected && setStep(2)} disabled={!selected}>
                NEXT — MARK & MEASURE →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: MARK & MEASURE ── */}
      {step === 2 && (
        <div className="atelier-step2">
          {/* LEFT: product + extras */}
          <div className="atelier-left">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 8,
                letterSpacing: "0.22em", color: "rgba(201,168,76,0.45)", marginBottom: 10 }}>
                SELECTED PRODUCT
              </div>
              <div style={{
                border: "1px solid #c9a84c", padding: "12px", display: "flex",
                gap: 10, alignItems: "center",
              }}>
                {selected?.image && <img src={selected.image} alt="" style={{
                  width: 44, height: 44, objectFit: "cover",
                  border: "1px solid rgba(201,168,76,0.2)", flexShrink: 0,
                }} onError={e => { e.target.style.display="none"; }} />}
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, color: "#f0ebe0" }}>
                    {selected?.name}
                  </div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10,
                    color: "#c9a84c", marginTop: 2 }}>${selected?.price}</div>
                </div>
              </div>
            </div>

            {others.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 8,
                  letterSpacing: "0.22em", color: "rgba(201,168,76,0.4)", marginBottom: 8 }}>
                  ALSO ADJUST
                </div>
                {others.map(p => (
                  <div key={p.id} onClick={() => setSelectedId(p.id)}
                    style={{
                      display: "flex", gap: 10, alignItems: "center",
                      padding: "8px", marginBottom: 6, cursor: "pointer",
                      border: "1px solid rgba(201,168,76,0.12)",
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(201,168,76,0.35)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(201,168,76,0.12)"}>
                    {p.image && <img src={p.image} alt="" style={{
                      width: 32, height: 32, objectFit: "cover", flexShrink: 0,
                    }} onError={e => { e.target.style.display="none"; }} />}
                    <div>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 12, color: "#f0ebe0" }}>{p.name}</div>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, color: "#c9a84c" }}>${p.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 8,
                letterSpacing: "0.22em", color: "rgba(201,168,76,0.4)", marginBottom: 10 }}>
                ORIGINAL SIZE
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {SIZES.map(s => (
                  <button key={s}
                    onClick={() => setSize(s)}
                    style={{
                      padding: "6px 12px",
                      border: `1px solid ${size === s ? "#c9a84c" : "rgba(201,168,76,0.2)"}`,
                      background: size === s ? "rgba(201,168,76,0.15)" : "transparent",
                      color: size === s ? "#c9a84c" : "rgba(240,235,224,0.5)",
                      fontFamily: "Montserrat,sans-serif", fontSize: 10, letterSpacing: "0.12em",
                      transition: "all 0.2s", cursor: "pointer",
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 8,
                letterSpacing: "0.22em", color: "rgba(201,168,76,0.4)", marginBottom: 10 }}>
                TAILOR ADD-ONS
              </div>
              {[
                { key: "rush",    label: "Rush delivery (+$15)" },
                { key: "premium", label: "Premium packaging (+$8)" },
              ].map(a => (
                <label key={a.key} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 8, cursor: "pointer",
                  fontFamily: "Montserrat,sans-serif", fontSize: 10,
                  color: "rgba(240,235,224,0.55)", letterSpacing: "0.08em",
                }}>
                  <input type="checkbox" checked={addOns[a.key]}
                    onChange={e => setAddOns(ao => ({ ...ao, [a.key]: e.target.checked }))}
                    style={{ accentColor: "#c9a84c", width: 14, height: 14 }} />
                  {a.label}
                </label>
              ))}
            </div>
          </div>

          {/* CENTER: body diagram */}
          <div className="atelier-center">
            <p style={{ fontFamily: "Montserrat,sans-serif", fontSize: 8, letterSpacing: "0.22em",
              color: "rgba(201,168,76,0.35)", marginBottom: 16, textAlign: "center" }}>
              CLICK A POINT ON THE BODY TO MARK A MEASUREMENT AREA
            </p>
            <BodySVG selected={selectedPt} onSelect={setSelectedPt} />
          </div>

          {/* RIGHT: measurement inputs */}
          <div className="atelier-right">
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 8,
              letterSpacing: "0.22em", color: "rgba(240,235,224,0.35)", marginBottom: 14 }}>
              MEASUREMENTS
              <span style={{
                marginLeft: 10, padding: "3px 10px",
                border: "1px solid #c9a84c", color: "#c9a84c",
                fontSize: 8, letterSpacing: "0.12em",
              }}>{activePt?.label}</span>
            </div>

            {MEASUREMENT_POINTS.map(pt => (
              <div key={pt.id} style={{ marginBottom: 14 }}
                onClick={() => setSelectedPt(pt.id)}>
                <label style={{
                  display: "block", fontFamily: "Montserrat,sans-serif",
                  fontSize: 8, letterSpacing: "0.18em",
                  color: selectedPt === pt.id ? "#c9a84c" : "rgba(240,235,224,0.4)",
                  marginBottom: 6, transition: "color 0.2s", cursor: "pointer",
                }}>
                  {pt.label.toUpperCase()} (CM)
                </label>
                <input
                  className="auth-input"
                  style={{ borderRadius: 0, padding: "9px 12px", fontSize: 13,
                    borderColor: selectedPt === pt.id ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.15)" }}
                  type="number"
                  value={measurements[pt.field]}
                  onChange={e => setM(pt.field, e.target.value)}
                  placeholder={pt.placeholder}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontFamily: "Montserrat,sans-serif",
                fontSize: 8, letterSpacing: "0.18em",
                color: "rgba(240,235,224,0.4)", marginBottom: 6 }}>TAILOR NOTES</label>
              <textarea
                className="auth-input"
                style={{ borderRadius: 0, padding: "9px 12px", fontSize: 12, minHeight: 72,
                  resize: "vertical", borderColor: "rgba(201,168,76,0.15)" }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. slightly looser around the arms..."
              />
            </div>

            <div style={{
              borderTop: "1px solid rgba(201,168,76,0.15)",
              paddingTop: 14, marginBottom: 14,
              fontFamily: "Montserrat,sans-serif", fontSize: 10,
              color: "rgba(240,235,224,0.5)",
            }}>
              {[
                { label: "Tailoring fee",   val: `+ $${tailorFee}` },
                { label: "Est. ready in",   val: "7–10 days" },
                { label: "Total with item", val: `$${total}`, bold: true },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between",
                  marginBottom: 6, color: r.bold ? "#f0ebe0" : undefined,
                  fontFamily: r.bold ? "'Playfair Display',serif" : undefined,
                  fontSize: r.bold ? 18 : 10 }}>
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10 }}>{r.label}</span>
                  <span>{r.val}</span>
                </div>
              ))}
            </div>

            <button className="auth-btn" style={{ borderRadius: 0, marginTop: 0, marginBottom: 8 }}
              onClick={() => setStep(3)}>
              NEXT — REVIEW & SEND →
            </button>
            <button onClick={() => setStep(1)}
              style={{ width: "100%", padding: "11px", textAlign: "center",
                border: "1px solid rgba(201,168,76,0.2)", color: "rgba(240,235,224,0.4)",
                fontFamily: "Montserrat,sans-serif", fontSize: 9, letterSpacing: "0.2em",
                background: "transparent", cursor: "pointer", transition: "all 0.2s" }}>
              SAVE MEASUREMENTS
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: CONFIRM & SEND ── */}
      {step === 3 && (
        <div className="atelier-body">
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 0" }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26,
              color: "#f0ebe0", marginBottom: 6 }}>Review & Confirm</h2>
            <p style={{ fontFamily: "Montserrat,sans-serif", fontSize: 9, letterSpacing: "0.2em",
              color: "rgba(240,235,224,0.35)", marginBottom: 32 }}>
              VERIFY YOUR ORDER BEFORE SENDING TO OUR TAILOR
            </p>

            {/* Product summary */}
            <div style={{
              border: "1px solid rgba(201,168,76,0.2)", padding: "18px 20px", marginBottom: 20,
            }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 8,
                letterSpacing: "0.2em", color: "rgba(201,168,76,0.45)", marginBottom: 12 }}>
                SELECTED PRODUCT
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {selected?.image && <img src={selected.image} alt="" style={{
                  width: 60, height: 60, objectFit: "cover",
                  border: "1px solid rgba(201,168,76,0.2)", flexShrink: 0,
                }} onError={e => { e.target.style.display="none"; }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17,
                    color: "#f0ebe0", marginBottom: 4 }}>{selected?.name}</div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10,
                    color: "rgba(240,235,224,0.4)", letterSpacing: "0.08em" }}>
                    Size {size} · ${selected?.price}
                  </div>
                </div>
              </div>
            </div>

            {/* Measurements summary */}
            <div style={{ border: "1px solid rgba(201,168,76,0.2)", padding: "18px 20px", marginBottom: 20 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 8,
                letterSpacing: "0.2em", color: "rgba(201,168,76,0.45)", marginBottom: 14 }}>
                MEASUREMENTS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {MEASUREMENT_POINTS.map(pt => (
                  <div key={pt.id} style={{ display: "flex", justifyContent: "space-between",
                    borderBottom: "1px solid rgba(201,168,76,0.08)", paddingBottom: 6 }}>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 9,
                      color: "rgba(240,235,224,0.35)", letterSpacing: "0.1em" }}>
                      {pt.label.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11,
                      color: measurements[pt.field] ? "#f0ebe0" : "rgba(240,235,224,0.2)" }}>
                      {measurements[pt.field] ? `${measurements[pt.field]} cm` : "—"}
                    </span>
                  </div>
                ))}
              </div>
              {notes && (
                <div style={{ marginTop: 12, fontFamily: "Montserrat,sans-serif",
                  fontSize: 10, color: "rgba(240,235,224,0.5)", fontStyle: "italic" }}>
                  Note: {notes}
                </div>
              )}
            </div>

            {/* Pricing */}
            <div style={{ border: "1px solid rgba(201,168,76,0.2)", padding: "18px 20px", marginBottom: 28 }}>
              {[
                { label: "Product price", val: `$${selected?.price}` },
                { label: "Tailoring fee", val: `$${35}` },
                addOns.rush    && { label: "Rush delivery",      val: "+$15" },
                addOns.premium && { label: "Premium packaging",  val: "+$8" },
                { label: "TOTAL",         val: `$${total}`, bold: true },
              ].filter(Boolean).map((r, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "7px 0",
                  borderBottom: r.bold ? "none" : "1px solid rgba(201,168,76,0.07)",
                  borderTop: r.bold ? "1px solid rgba(201,168,76,0.2)" : "none",
                  marginTop: r.bold ? 6 : 0,
                }}>
                  <span style={{ fontFamily: "Montserrat,sans-serif",
                    fontSize: r.bold ? 10 : 10, letterSpacing: "0.12em",
                    color: r.bold ? "#c9a84c" : "rgba(240,235,224,0.45)" }}>{r.label}</span>
                  <span style={{ fontFamily: r.bold ? "'Playfair Display',serif" : "Montserrat,sans-serif",
                    fontSize: r.bold ? 18 : 13, color: r.bold ? "#c9a84c" : "rgba(240,235,224,0.7)" }}>
                    {r.val}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setStep(2)}
                style={{
                  flex: 1, padding: "14px",
                  border: "1px solid rgba(201,168,76,0.2)",
                  color: "rgba(240,235,224,0.4)",
                  fontFamily: "Montserrat,sans-serif", fontSize: 9, letterSpacing: "0.2em",
                  background: "transparent", cursor: "pointer",
                }}>← BACK</button>
              <button className="auth-btn" style={{ flex: 2, borderRadius: 0 }}
                onClick={() => setSent(true)}>
                CONFIRM & SEND TO TAILOR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
