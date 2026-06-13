// ─────────────────────────────────────────────────────────────
// ORDER HISTORY PAGE
// Shows all past orders for the current user. Each order row
// is expandable to reveal item thumbnails and a cost breakdown.
// Orders are read from the `orders` prop (stored in App.jsx
// state + localStorage from Phase 2).
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { Logo, GoldDivider } from "./Shared";
import "../styles/account.css";

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function shortId(id = "") {
  return id.slice(-8).toUpperCase();
}

function OrderCard({ order }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="order-card">
      {/* Summary row — click to expand */}
      <div className="order-card__header" onClick={() => setOpen(o => !o)}>
        <div className="order-card__id">
          ORDER #{shortId(order.id)}
          <span>{formatDate(order.createdAt)}</span>
        </div>
        <span className={`order-status order-status--${order.status ?? "confirmed"}`}>
          {(order.status ?? "confirmed").toUpperCase()}
        </span>
        <span className="order-card__total">${(order.total ?? 0).toFixed(2)}</span>
        <span className={`order-card__chevron${open ? " order-card__chevron--open" : ""}`}>▾</span>
      </div>

      {/* Expanded detail */}
      <div className={`order-card__body${open ? " order-card__body--open" : ""}`}>
        {/* Item thumbnails */}
        <div className="order-items-grid">
          {(order.items ?? []).map((item, i) => (
            <div key={i} className="order-item-thumb">
              <img
                src={item.productImage}
                alt={item.productName}
                onError={e => { e.target.style.display = "none"; }}
              />
              <span className="order-item-thumb__name">{item.productName}</span>
              <span className="order-item-thumb__qty">
                {item.quantity > 1 ? `× ${item.quantity}` : "1 unit"}
                {item.selectedColor ? ` · ${item.selectedColor}` : ""}
              </span>
            </div>
          ))}
        </div>

        {/* Cost breakdown + shipping address */}
        <div className="order-card__breakdown">
          <div className="order-card__breakdown-item">
            <span className="order-card__breakdown-label">SUBTOTAL</span>
            <span className="order-card__breakdown-value">${(order.subtotal ?? 0).toFixed(2)}</span>
          </div>
          {(order.discount ?? 0) > 0 && (
            <div className="order-card__breakdown-item">
              <span className="order-card__breakdown-label">DISCOUNT</span>
              <span className="order-card__breakdown-value" style={{ color: "#6aac8a" }}>
                −${(order.discount).toFixed(2)}
              </span>
            </div>
          )}
          <div className="order-card__breakdown-item">
            <span className="order-card__breakdown-label">SHIPPING</span>
            <span className="order-card__breakdown-value">
              {(order.shipping ?? 0) === 0 ? "FREE" : `$${(order.shipping ?? 0).toFixed(2)}`}
            </span>
          </div>
          <div className="order-card__breakdown-item">
            <span className="order-card__breakdown-label">TOTAL</span>
            <span className="order-card__breakdown-value" style={{ color: "#c9a84c" }}>
              ${(order.total ?? 0).toFixed(2)}
            </span>
          </div>
          {order.shippingAddress && (
            <div className="order-card__breakdown-item" style={{ marginLeft: "auto" }}>
              <span className="order-card__breakdown-label">SHIPPED TO</span>
              <span className="order-card__breakdown-value">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName},&nbsp;
                {order.shippingAddress.city}, {order.shippingAddress.country}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Coupon card ───────────────────────────────────────────────
function CouponCard({ coupon }) {
  const [copied, setCopied] = useState(false);
  const now       = new Date();
  const isExpired = coupon.expiresAt ? new Date(coupon.expiresAt) < now : false;
  const isUsed    = !!coupon.used;
  const inactive  = isUsed || isExpired;

  const typeLabel =
    coupon.type === "PERCENTAGE" ? "% OFF" :
    coupon.type === "FIXED"      ? "$ OFF" : "B1G1";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — silent */
    }
  };

  return (
    <div className={`coupon-card${inactive ? " coupon-card--inactive" : ""}`}>
      {/* Left accent strip */}
      <div className="coupon-card__type-strip">{typeLabel}</div>

      {/* Main info */}
      <div className="coupon-card__body">
        <div className="coupon-card__label">{coupon.label}</div>
        <div className="coupon-card__desc">{coupon.desc}</div>
        <div className="coupon-card__meta">
          Expires {formatDate(coupon.expiresAt)}
        </div>
      </div>

      {/* Right: code + status + copy */}
      <div className="coupon-card__right">
        <span className={`coupon-card__status coupon-card__status--${isUsed ? "used" : isExpired ? "expired" : "available"}`}>
          {isUsed ? "USED" : isExpired ? "EXPIRED" : "AVAILABLE"}
        </span>
        <div className="coupon-card__code">{coupon.code}</div>
        {!inactive && (
          <button className="coupon-card__copy" onClick={handleCopy}>
            {copied ? "✓ COPIED" : "COPY CODE"}
          </button>
        )}
      </div>

      {/* Decorative notches */}
      <div className="coupon-card__notch coupon-card__notch--left" />
      <div className="coupon-card__notch coupon-card__notch--right" />
    </div>
  );
}

export default function OrderHistoryPage({ orders, coupons, currentUser, onBack, onShop }) {
  const [activeTab, setActiveTab] = useState("orders");

  const userOrders  = (orders  ?? []).filter(o => o.userId  === currentUser?.id);
  const userCoupons = (coupons ?? []).filter(c => c.userId  === currentUser?.id);
  const availableCouponCount = userCoupons.filter(c => !c.used && new Date(c.expiresAt) > new Date()).length;

  return (
    <div className="orders-page page-enter">

      {/* Nav */}
      <div className="orders-nav">
        <Logo onClick={onBack} />
        <h1 className="orders-nav__title">MY ACCOUNT</h1>
        <button className="nav-btn nav-btn--ghost" onClick={onBack}>← BACK</button>
      </div>
      <GoldDivider style={{ width: "100%" }} />

      <div className="orders-body">
        <div className="orders-header">
          <h2 className="orders-heading">
            {(currentUser?.email ?? "Guest").split("@")[0]}
          </h2>
          <p className="orders-subheading">
            {currentUser?.email ?? ""}
          </p>
        </div>

        {/* Tab bar */}
        <div className="account-tabs">
          <button
            className={`account-tab${activeTab === "orders" ? " account-tab--active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            ORDERS
            {userOrders.length > 0 && (
              <span className="account-tab__badge">{userOrders.length}</span>
            )}
          </button>
          <button
            className={`account-tab${activeTab === "coupons" ? " account-tab--active" : ""}`}
            onClick={() => setActiveTab("coupons")}
          >
            MY COUPONS
            {availableCouponCount > 0 && (
              <span className="account-tab__badge account-tab__badge--gold">{availableCouponCount}</span>
            )}
          </button>
        </div>

        <GoldDivider style={{ marginBottom: 28 }} />

        {/* ── Orders tab ── */}
        {activeTab === "orders" && (
          userOrders.length === 0 ? (
            <div className="orders-empty">
              <span className="orders-empty__icon">◻</span>
              <p className="orders-empty__title">No orders yet</p>
              <p className="orders-empty__sub">
                Your order history will appear here after your first purchase.
              </p>
              <button className="orders-empty__cta" onClick={onShop}>
                BROWSE COLLECTION
              </button>
            </div>
          ) : (
            <div className="orders-list">
              {userOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )
        )}

        {/* ── Coupons tab ── */}
        {activeTab === "coupons" && (
          userCoupons.length === 0 ? (
            <div className="orders-empty">
              <span className="orders-empty__icon">✦</span>
              <p className="orders-empty__title">No coupons yet</p>
              <p className="orders-empty__sub">
                Complete a purchase for a chance to win discount coupons via the Ticket Machine.
              </p>
              <button className="orders-empty__cta" onClick={onShop}>
                BROWSE COLLECTION
              </button>
            </div>
          ) : (
            <div className="coupons-list">
              {userCoupons.map(coupon => (
                <CouponCard key={coupon.id} coupon={coupon} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
