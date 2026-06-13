// ─────────────────────────────────────────────────────────────
// TICKET MACHINE PAGE  (Phase 4)
//
// Post-checkout gamification screen. Shown immediately after
// every successful order.  The result is computed at mount:
//   · 5%  → win  → random coupon (percentage / fixed / BOGO)
//   · 95% → lose → polite thank-you message
//
// Animation phases (auto-advance, no user interaction needed):
//   'idle'     – machine shown, no motion
//   'spinning' – all 3 reels cycle symbols at 65 ms/frame
//   'stop0/1/2'– reels stop one-by-one (400 ms apart)
//   'result'   – win card or lose message slides in
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { Logo, GoldDivider } from "./Shared";
import "../styles/ticketmachine.css";

// ── Constants ────────────────────────────────────────────────
const SYMBOLS    = ["✦", "◈", "⬡", "✿", "◆", "✧"];
const WIN_SYMBOL = "✦";
const WIN_CHANCE = 0.05;

const COUPON_POOL = [
  { type: "PERCENTAGE", label: "10% OFF",       desc: "your entire next order",  code: "EST10OFF",  value: "10%" },
  { type: "FIXED",      label: "$15 OFF",        desc: "on orders over $60",      code: "EST15USD",  value: "$15" },
  { type: "BOGO",       label: "BUY 1 GET 1",   desc: "free on selected items",  code: "ESTBOGO1",  value: "B1G1" },
];

const SPARKLE_COLORS = [
  "#c9a84c", "#e8c878", "#f0ebe0",
  "#fff8e7", "#d4a843", "#ffd97d",
];

// ── Helpers ──────────────────────────────────────────────────
function pickCoupon() {
  return COUPON_POOL[Math.floor(Math.random() * COUPON_POOL.length)];
}

function buildLoseSymbols() {
  const pool = SYMBOLS.filter(s => s !== WIN_SYMBOL);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  // Guarantee at least one mismatch from first
  if (shuffled[0] === shuffled[1]) shuffled[1] = pool[(pool.indexOf(shuffled[1]) + 1) % pool.length];
  return [shuffled[0], shuffled[1], shuffled[2] ?? shuffled[0]];
}

function shortOrderId(id = "") {
  return id.slice(-8).toUpperCase();
}

function formatDate(iso) {
  try { return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(iso)); }
  catch { return ""; }
}

// ── Sparkle component (win celebration) ──────────────────────
function Sparkles() {
  const particles = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    left:  `${5 + Math.random() * 90}%`,
    top:   `${60 + Math.random() * 35}%`,
    color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
    delay: `${Math.random() * 0.8}s`,
    size:  `${4 + Math.random() * 6}px`,
  }));

  return (
    <div className="tm-sparkles" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="tm-sparkle"
          style={{
            left: p.left, top: p.top,
            background: p.color,
            width: p.size, height: p.size,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

// ── Single reel ───────────────────────────────────────────────
function Reel({ spinning, stopped, targetSymbol }) {
  const [displayed, setDisplayed] = useState(SYMBOLS[0]);
  const timerRef = useRef(null);
  const idxRef   = useRef(0);

  useEffect(() => {
    clearInterval(timerRef.current);
    clearTimeout(timerRef.current);

    if (spinning && !stopped) {
      timerRef.current = setInterval(() => {
        idxRef.current = (idxRef.current + 1) % SYMBOLS.length;
        setDisplayed(SYMBOLS[idxRef.current]);
      }, 65);
    } else if (stopped) {
      setDisplayed(targetSymbol);
    }

    return () => {
      clearInterval(timerRef.current);
      clearTimeout(timerRef.current);
    };
  }, [spinning, stopped, targetSymbol]);

  const isWin = stopped && targetSymbol === WIN_SYMBOL;

  return (
    <div className={[
      "tm-reel",
      spinning && !stopped ? "tm-reel--spinning" : "",
      stopped              ? "tm-reel--stopped"  : "",
      isWin                ? "tm-reel--gold"     : "",
    ].join(" ")}>
      <span className="tm-reel__symbol">{displayed}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function TicketMachinePage({ order, currentUser, onSaveCoupon, onContinue }) {
  // Determine outcome once at mount
  const outcomeRef = useRef(null);
  if (!outcomeRef.current) {
    const didWin = Math.random() < WIN_CHANCE;
    const coupon = didWin ? pickCoupon() : null;
    const finalSymbols = didWin
      ? [WIN_SYMBOL, WIN_SYMBOL, WIN_SYMBOL]
      : buildLoseSymbols();
    outcomeRef.current = { didWin, coupon, finalSymbols };
  }
  const { didWin, coupon, finalSymbols } = outcomeRef.current;

  // Animation phases
  const [phase, setPhase] = useState("idle");
  // stoppedReels[i] = true once that reel has locked in
  const [stoppedReels, setStoppedReels] = useState([false, false, false]);
  const [showResult, setShowResult]     = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);

  // Coupon save flag (save exactly once)
  const savedRef = useRef(false);

  useEffect(() => {
    const t = [];
    t.push(setTimeout(() => setPhase("spinning"),        700));
    t.push(setTimeout(() => setStoppedReels([true, false, false]),  2700));
    t.push(setTimeout(() => setStoppedReels([true, true,  false]),  3200));
    t.push(setTimeout(() => setStoppedReels([true, true,  true]),   3700));
    t.push(setTimeout(() => {
      setShowResult(true);
      if (didWin && !savedRef.current) {
        savedRef.current = true;
        const fullCoupon = {
          ...coupon,
          id:        (globalThis.crypto?.randomUUID?.()) || `cpn-${Date.now()}`,
          userId:    currentUser?.id,
          orderId:   order?.id,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          used:      false,
        };
        onSaveCoupon?.(fullCoupon);
        setShowSparkles(true);
        setTimeout(() => setShowSparkles(false), 2200);
      }
    }, 4400));
    return () => t.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allWin = didWin && stoppedReels[2];

  const statusText = () => {
    if (phase === "idle")    return "preparing your fortune…";
    if (!stoppedReels[0])    return "DRAWING YOUR FORTUNE…";
    if (!stoppedReels[1])    return "HOLD…";
    if (!stoppedReels[2])    return "ALMOST…";
    if (!showResult)         return "REVEALING…";
    return "";
  };

  return (
    <div className="tm-page page-enter">
      {showSparkles && <Sparkles />}

      {/* Nav */}
      <div className="tm-nav">
        <Logo />
        {showResult && (
          <button className="nav-btn nav-btn--ghost" onClick={onContinue}>
            CONTINUE SHOPPING →
          </button>
        )}
      </div>
      <GoldDivider style={{ width: "100%" }} />

      <div className="tm-body">

        {/* Title */}
        <p className="tm-eyebrow">ORDER #{shortOrderId(order?.id)} · {formatDate(order?.createdAt)}</p>
        <h1 className="tm-title">
          Your <span>Fortune</span> Awaits
        </h1>

        {/* The Machine */}
        <div className={`tm-machine${allWin ? " tm-machine--win" : ""}`}>
          <p className="tm-machine__label">✦ &nbsp; TICKET MACHINE &nbsp; ✦</p>

          <div className="tm-reels">
            {[0, 1, 2].map(i => (
              <Reel
                key={i}
                spinning={phase === "spinning"}
                stopped={stoppedReels[i]}
                targetSymbol={finalSymbols[i]}
              />
            ))}
          </div>

          <p className={`tm-status${phase === "spinning" || (phase === "idle") ? " tm-status--active" : ""}`}>
            {statusText()}
          </p>

          <div className="tm-machine__footer">
            <span className="tm-order-badge">
              ORDER&nbsp;<span>#{shortOrderId(order?.id)}</span>
            </span>
            <span className="tm-order-badge">
              TOTAL&nbsp;<span>${(order?.total ?? 0).toFixed(2)}</span>
            </span>
          </div>
        </div>

        {/* Result */}
        {showResult && (
          <div className="tm-result">
            <p className="tm-result-label">
              {didWin ? "✦  YOUR FORTUNE  ✦" : "— THIS ROUND —"}
            </p>

            {didWin ? (
              /* WIN — golden ticket */
              <div className="tm-ticket">
                <div className="tm-ticket__notch-l" />
                <div className="tm-ticket__notch-r" />

                <p className="tm-ticket__congrats">CONGRATULATIONS!</p>
                <div className="tm-ticket__headline">{coupon.label}</div>
                <p className="tm-ticket__sub">{coupon.desc}</p>

                <GoldDivider style={{ width: 100, margin: "0 auto 24px" }} />

                <p className="tm-ticket__code-label">YOUR COUPON CODE</p>
                <div className="tm-ticket__code">{coupon.code}</div>
                <p className="tm-ticket__expiry">Valid for 30 days · Single use</p>
              </div>
            ) : (
              /* LOSE */
              <div className="tm-lose">
                <span className="tm-lose__icon">◻</span>
                <p className="tm-lose__title">Thank you for your order!</p>
                <p className="tm-lose__body">
                  Unfortunately, you didn&apos;t win a coupon this time.
                  Better luck on your next order!
                </p>
              </div>
            )}

            {/* Order confirmed pill */}
            <div className="tm-confirmed">
              <span>Order #{shortOrderId(order?.id)}</span>
              <span className="tm-confirmed__badge">✓ CONFIRMED</span>
              <span>A confirmation has been noted.</span>
            </div>

            <div style={{ textAlign: "center" }}>
              <button className="tm-continue-btn" onClick={onContinue}>
                CONTINUE SHOPPING
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
