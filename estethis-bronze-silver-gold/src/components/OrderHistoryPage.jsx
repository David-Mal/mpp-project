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

export default function OrderHistoryPage({ orders, currentUser, onBack, onShop }) {
  const userOrders = (orders ?? []).filter(o => o.userId === currentUser?.id);

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
          <h2 className="orders-heading">Order History</h2>
          <p className="orders-subheading">
            {userOrders.length > 0
              ? `${userOrders.length} ORDER${userOrders.length !== 1 ? "S" : ""} · ${currentUser?.email ?? ""}`
              : `WELCOME, ${(currentUser?.email ?? "GUEST").split("@")[0].toUpperCase()}`}
          </p>
        </div>

        <GoldDivider width={120} style={{ marginBottom: 32 }} />

        {userOrders.length === 0 ? (
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
        )}
      </div>
    </div>
  );
}
