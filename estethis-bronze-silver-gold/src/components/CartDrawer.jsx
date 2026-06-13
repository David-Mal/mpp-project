// ─────────────────────────────────────────────────────────────
// CART DRAWER
// Slide-in panel from the right edge. Renders in the DOM at all
// times so the CSS transform transition plays on open/close.
// ─────────────────────────────────────────────────────────────

import { GoldDivider } from "./Shared";
import "../styles/cart.css";

export default function CartDrawer({ isOpen, items, onClose, onRemove, onUpdateQty, onCheckout }) {
  const subtotal    = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalQty    = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      {/* Backdrop — click to close */}
      {isOpen && <div className="cart-backdrop" onClick={onClose} />}

      {/* Drawer */}
      <div className={`cart-drawer ${isOpen ? "cart-drawer--open" : ""}`} role="dialog" aria-label="Shopping cart">

        {/* Header */}
        <div className="cart-drawer__header">
          <div>
            <h2 className="cart-drawer__title">YOUR CART</h2>
            <p className="cart-drawer__count">
              {totalQty} ITEM{totalQty !== 1 ? "S" : ""}
            </p>
          </div>
          <button className="cart-drawer__close" onClick={onClose} aria-label="Close cart">
            ✕
          </button>
        </div>

        <GoldDivider style={{ width: "100%", flexShrink: 0 }} />

        {/* Empty state */}
        {items.length === 0 ? (
          <div className="cart-drawer__empty">
            <span style={{ fontSize: 38, lineHeight: 1 }}>◻</span>
            <p>Your cart is empty</p>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="cart-drawer__items">
              {items.map(item => (
                <div key={item.product.id} className="cart-item">
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="cart-item__img"
                    onError={e => { e.target.style.display = "none"; }}
                  />

                  <div className="cart-item__info">
                    <p className="cart-item__name">{item.product.name}</p>
                    {(item.selectedColor || item.selectedSize) && (
                      <p className="cart-item__meta">
                        {[item.selectedColor, item.selectedSize].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="cart-item__price">${item.product.price}</p>
                  </div>

                  <div className="cart-item__qty">
                    <button
                      className="qty-btn"
                      onClick={() => onUpdateQty(item.product.id, item.quantity - 1)}
                      aria-label="Decrease quantity"
                    >−</button>
                    <span className="qty-val">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => onUpdateQty(item.product.id, item.quantity + 1)}
                      aria-label="Increase quantity"
                    >+</button>
                  </div>

                  <button
                    className="cart-item__remove"
                    onClick={() => onRemove(item.product.id)}
                    aria-label={`Remove ${item.product.name}`}
                  >×</button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="cart-drawer__footer">
              <GoldDivider style={{ width: "100%", marginBottom: 20 }} />
              <div className="cart-drawer__total">
                <span className="cart-drawer__total-label">TOTAL</span>
                <span className="cart-drawer__total-value">${subtotal.toFixed(2)}</span>
              </div>
              <button className="cart-drawer__checkout-btn" onClick={onCheckout}>
                PROCEED TO CHECKOUT
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
