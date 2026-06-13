// ─────────────────────────────────────────────────────────────
// CHECKOUT PAGE
// Two-column layout: shipping + payment forms on the left,
// order summary on the right. Payment is fully simulated —
// no real charges. Validates all fields before submitting.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { Logo, GoldDivider } from "./Shared";
import "../styles/cart.css";

// ── Format helpers ────────────────────────────────────────────
function fmtCard(val) {
  return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ");
}
function fmtExpiry(val) {
  const d = val.replace(/\D/g, "").slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

// ── Validation ───────────────────────────────────────────────
function validate(f) {
  const e = {};
  if (!f.firstName.trim()) e.firstName = "Required";
  if (!f.lastName.trim())  e.lastName  = "Required";
  if (!f.email.trim() || !f.email.includes("@")) e.email = "Valid email required";
  if (!f.address.trim())   e.address   = "Required";
  if (!f.city.trim())      e.city      = "Required";
  if (!f.country.trim())   e.country   = "Required";
  if (!f.zip.trim())       e.zip       = "Required";

  const digits = f.cardNumber.replace(/\D/g, "");
  if (digits.length !== 16) e.cardNumber = "16-digit card number required";

  const parts = f.expiry.split("/");
  if (parts.length !== 2 || parts[0].length !== 2 || parts[1].length !== 2) {
    e.expiry = "MM/YY required";
  } else if (parseInt(parts[0]) < 1 || parseInt(parts[0]) > 12) {
    e.expiry = "Invalid month";
  }
  if (f.cvv.length < 3) e.cvv = "3–4 digit CVV required";
  if (!f.nameOnCard.trim()) e.nameOnCard = "Required";
  return e;
}

// ── Sub-components ────────────────────────────────────────────
function Field({ id, label, error, className = "", children }) {
  return (
    <div className={`checkout-field ${className}`}>
      <label className="checkout-label" htmlFor={id}>{label}</label>
      {children}
      {error && <span className="checkout-field-error">{error}</span>}
    </div>
  );
}

// ── Coupon helpers ────────────────────────────────────────────
function computeDiscount(coupon, subtotal, items) {
  if (!coupon) return 0;
  switch (coupon.type) {
    case "PERCENTAGE": {
      const pct = parseFloat(coupon.value) / 100;
      return Math.round(subtotal * pct * 100) / 100;
    }
    case "FIXED": {
      const amount = parseFloat(coupon.value.replace(/[^0-9.]/g, ""));
      return Math.min(amount, subtotal);
    }
    case "BOGO": {
      // Cheapest single unit is free
      const prices = items.flatMap(i => Array(i.quantity).fill(i.product.price));
      return prices.length > 0 ? Math.min(...prices) : 0;
    }
    default:
      return 0;
  }
}

// ── Main component ────────────────────────────────────────────
export default function CheckoutPage({ items, onBack, onPlaceOrder, coupons = [], currentUser = null }) {
  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const shipping = subtotal > 0 ? 9.99 : 0;

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    address: "", city: "", country: "", zip: "",
    cardNumber: "", expiry: "", cvv: "", nameOnCard: "",
  });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  // ── Coupon state ──────────────────────────────────────────
  const [couponInput,   setCouponInput]   = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMsg,     setCouponMsg]     = useState({ text: "", ok: false });

  const discount = computeDiscount(appliedCoupon, subtotal, items);
  const total    = Math.max(0, subtotal + shipping - discount);

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    const found = coupons.find(c => (c.code ?? "").toUpperCase() === code);
    if (!found) {
      setCouponMsg({ text: "Coupon code not found.", ok: false });
      return;
    }
    if (found.userId !== currentUser?.id) {
      setCouponMsg({ text: "This coupon doesn't belong to your account.", ok: false });
      return;
    }
    if (found.used) {
      setCouponMsg({ text: "This coupon has already been used.", ok: false });
      return;
    }
    if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
      setCouponMsg({ text: "This coupon has expired.", ok: false });
      return;
    }
    setAppliedCoupon(found);
    setCouponMsg({ text: `✓ "${found.label}" applied!`, ok: true });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponMsg({ text: "", ok: false });
  };

  const set = field => e => {
    let v = e.target.value;
    if (field === "cardNumber") v = fmtCard(v);
    if (field === "expiry")     v = fmtExpiry(v);
    if (field === "cvv")        v = v.replace(/\D/g, "").slice(0, 4);
    setForm(f => ({ ...f, [field]: v }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1600)); // Simulate processing

    onPlaceOrder({
      shippingAddress: {
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email,
        address:   form.address,
        city:      form.city,
        country:   form.country,
        zip:       form.zip,
      },
      appliedCouponId: appliedCoupon?.id ?? null,
      discount,
    });
  };

  return (
    <div className="checkout-page page-enter">

      {/* Nav */}
      <div className="checkout-nav">
        <Logo onClick={onBack} />
        <h1 className="checkout-nav__title">CHECKOUT</h1>
        <button className="nav-btn nav-btn--ghost" onClick={onBack}>← BACK</button>
      </div>
      <GoldDivider style={{ width: "100%" }} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="checkout-body">

          {/* LEFT: Forms */}
          <div className="checkout-forms">

            {/* Shipping */}
            <div>
              <p className="checkout-section-title">SHIPPING INFORMATION</p>
              <div className="checkout-grid">
                <Field id="firstName" label="FIRST NAME" error={errors.firstName}>
                  <input id="firstName" className={`checkout-input${errors.firstName ? " checkout-input--error" : ""}`}
                    value={form.firstName} onChange={set("firstName")} placeholder="First name" />
                </Field>
                <Field id="lastName" label="LAST NAME" error={errors.lastName}>
                  <input id="lastName" className={`checkout-input${errors.lastName ? " checkout-input--error" : ""}`}
                    value={form.lastName} onChange={set("lastName")} placeholder="Last name" />
                </Field>
                <Field id="email" label="EMAIL ADDRESS" className="checkout-field--full" error={errors.email}>
                  <input id="email" type="email" className={`checkout-input${errors.email ? " checkout-input--error" : ""}`}
                    value={form.email} onChange={set("email")} placeholder="you@example.com" />
                </Field>
                <Field id="address" label="ADDRESS" className="checkout-field--full" error={errors.address}>
                  <input id="address" className={`checkout-input${errors.address ? " checkout-input--error" : ""}`}
                    value={form.address} onChange={set("address")} placeholder="123 Main Street" />
                </Field>
                <Field id="city" label="CITY" error={errors.city}>
                  <input id="city" className={`checkout-input${errors.city ? " checkout-input--error" : ""}`}
                    value={form.city} onChange={set("city")} placeholder="New York" />
                </Field>
                <Field id="zip" label="ZIP / POSTAL CODE" error={errors.zip}>
                  <input id="zip" className={`checkout-input${errors.zip ? " checkout-input--error" : ""}`}
                    value={form.zip} onChange={set("zip")} placeholder="10001" />
                </Field>
                <Field id="country" label="COUNTRY" className="checkout-field--full" error={errors.country}>
                  <input id="country" className={`checkout-input${errors.country ? " checkout-input--error" : ""}`}
                    value={form.country} onChange={set("country")} placeholder="United States" />
                </Field>
              </div>
            </div>

            {/* Payment */}
            <div>
              <p className="checkout-section-title">
                PAYMENT DETAILS
                <span className="checkout-section-tag">— SIMULATED · NO REAL CHARGES</span>
              </p>
              <div className="checkout-grid">
                <Field id="cardNumber" label="CARD NUMBER" className="checkout-field--full" error={errors.cardNumber}>
                  <input id="cardNumber"
                    className={`checkout-input checkout-input--mono${errors.cardNumber ? " checkout-input--error" : ""}`}
                    value={form.cardNumber} onChange={set("cardNumber")}
                    placeholder="4242 4242 4242 4242" inputMode="numeric" />
                  <div className="card-icons">
                    <span className="card-icon">VISA</span>
                    <span className="card-icon">MC</span>
                    <span className="card-icon">AMEX</span>
                  </div>
                </Field>
                <Field id="expiry" label="EXPIRY (MM/YY)" error={errors.expiry}>
                  <input id="expiry" className={`checkout-input${errors.expiry ? " checkout-input--error" : ""}`}
                    value={form.expiry} onChange={set("expiry")} placeholder="12/28" inputMode="numeric" />
                </Field>
                <Field id="cvv" label="CVV" error={errors.cvv}>
                  <input id="cvv" className={`checkout-input${errors.cvv ? " checkout-input--error" : ""}`}
                    value={form.cvv} onChange={set("cvv")} placeholder="123" inputMode="numeric" />
                </Field>
                <Field id="nameOnCard" label="NAME ON CARD" className="checkout-field--full" error={errors.nameOnCard}>
                  <input id="nameOnCard" className={`checkout-input${errors.nameOnCard ? " checkout-input--error" : ""}`}
                    value={form.nameOnCard} onChange={set("nameOnCard")} placeholder="JOHN DOE"
                    style={{ textTransform: "uppercase" }} />
                </Field>
              </div>

              <button type="submit" className="checkout-submit-btn" disabled={submitting}>
                {submitting ? "PROCESSING…" : discount > 0
                  ? `PLACE ORDER — $${total.toFixed(2)} (save $${discount.toFixed(2)})`
                  : `PLACE ORDER — $${total.toFixed(2)}`}
              </button>
              <p className="secure-notice">🔒 &nbsp;Simulated checkout — no real payment will be processed</p>
            </div>
          </div>

          {/* RIGHT: Order Summary */}
          <aside className="checkout-summary">
            <div className="checkout-summary__header">ORDER SUMMARY</div>

            <div className="checkout-summary__items">
              {items.map(item => (
                <div key={item.product.id} className="checkout-summary__item">
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="checkout-summary__item-img"
                    onError={e => { e.target.style.display = "none"; }}
                  />
                  <div className="checkout-summary__item-info" style={{ flex: 1, minWidth: 0 }}>
                    <p className="checkout-summary__item-name">{item.product.name}</p>
                    <p className="checkout-summary__item-qty">
                      {[item.selectedColor, item.selectedSize].filter(Boolean).join(" · ")}
                      {item.quantity > 1 && ` × ${item.quantity}`}
                    </p>
                  </div>
                  <span className="checkout-summary__item-price">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <hr className="checkout-summary__divider" />

            {/* Coupon section */}
            <div className="checkout-coupon">
              <p className="checkout-coupon__title">PROMO CODE</p>
              {appliedCoupon ? (
                <div className="checkout-coupon__applied">
                  <span className="checkout-coupon__applied-label">
                    ✦ {appliedCoupon.label}
                  </span>
                  <button className="checkout-coupon__remove" onClick={handleRemoveCoupon}>
                    ✕
                  </button>
                </div>
              ) : (
                <div className="checkout-coupon__row">
                  <input
                    className="checkout-coupon__input"
                    placeholder="Enter code…"
                    value={couponInput}
                    onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponMsg({ text: "", ok: false }); }}
                    onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                  />
                  <button className="checkout-coupon__btn" onClick={handleApplyCoupon}>
                    APPLY
                  </button>
                </div>
              )}
              {couponMsg.text && (
                <p className={`checkout-coupon__msg${couponMsg.ok ? " checkout-coupon__msg--ok" : " checkout-coupon__msg--err"}`}>
                  {couponMsg.text}
                </p>
              )}
            </div>

            <hr className="checkout-summary__divider" />

            <div className="checkout-summary__totals">
              <div className="checkout-summary__line">
                <span>SUBTOTAL</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="checkout-summary__line checkout-summary__line--discount">
                  <span>DISCOUNT</span>
                  <span>−${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="checkout-summary__line">
                <span>SHIPPING</span>
                <span>{shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}</span>
              </div>
              <div className="checkout-summary__line checkout-summary__line--total">
                <span>TOTAL</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
