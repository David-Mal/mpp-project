// ─────────────────────────────────────────────────────────────
// GUEST AUTH MODAL (Phase 6)
//
// Intercept overlay shown when an unauthenticated guest
// attempts a protected action (Add to Cart, Checkout, My Account).
// Offers Sign-In or Register, or lets the user dismiss and
// continue browsing.
// ─────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { GoldDivider } from './Shared';

export default function GuestAuthModal({ isOpen, onSignIn, onRegister, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="guest-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in required"
    >
      <div className="guest-modal" onClick={e => e.stopPropagation()}>
        <button
          className="guest-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="guest-modal__ornament">✦</div>
        <h2 className="guest-modal__title">Sign in to continue</h2>
        <GoldDivider style={{ margin: '10px auto 16px', width: 48 }} />

        <p className="guest-modal__text">
          Create an account or sign in to add items to your cart,
          place orders, and track your purchases.
        </p>

        <div className="guest-modal__actions">
          <button
            className="guest-modal__btn guest-modal__btn--primary"
            onClick={onSignIn}
          >
            SIGN IN
          </button>
          <button
            className="guest-modal__btn guest-modal__btn--secondary"
            onClick={onRegister}
          >
            CREATE ACCOUNT
          </button>
        </div>

        <button className="guest-modal__dismiss" onClick={onClose}>
          Continue browsing
        </button>
      </div>
    </div>
  );
}
