// ─────────────────────────────────────────────────────────────
// FOOTER
// Site-wide footer rendered at the bottom of MasterView and
// all three static pages. Accepts an `onNavigate(view)` prop
// so its links can trigger SPA navigation without router.
// ─────────────────────────────────────────────────────────────

import "../styles/account.css";

export default function Footer({ onNavigate }) {
  const nav = view => () => onNavigate?.(view);

  return (
    <footer className="site-footer">
      <div className="footer-body">

        {/* Brand column */}
        <div className="footer-brand">
          <div className="footer-brand__name">Estethis</div>
          <div className="footer-brand__tagline">ELEVATE YOUR WARDROBE</div>
          <p className="footer-brand__desc">
            A house devoted to the art of refined dressing. Each garment is a
            conversation between tradition and the modern world — made to be
            worn for decades, not seasons.
          </p>
        </div>

        {/* Navigation column */}
        <div>
          <p className="footer-col__title">EXPLORE</p>
          <div className="footer-links">
            <button className="footer-link" onClick={nav("about")}>About Us</button>
            <button className="footer-link" onClick={nav("contact")}>Contact</button>
            <button className="footer-link" onClick={nav("terms")}>Terms & Conditions</button>
            <button className="footer-link" onClick={nav("orderHistory")}>My Orders</button>
          </div>
        </div>

        {/* Contact column */}
        <div>
          <p className="footer-col__title">CONTACT</p>
          <div className="footer-contact-items">
            <div className="footer-contact-item">
              <p className="footer-contact-label">EMAIL</p>
              <p className="footer-contact-value">hello@estethis.com</p>
            </div>
            <div className="footer-contact-item">
              <p className="footer-contact-label">PHONE</p>
              <p className="footer-contact-value">+1 (212) 555-0174</p>
            </div>
            <div className="footer-contact-item">
              <p className="footer-contact-label">HEADQUARTERS</p>
              <p className="footer-contact-value">Florence, Italy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <span className="footer-copyright">
          © {new Date().getFullYear()} Estethis. All rights reserved.
        </span>
        <div className="footer-legal-links">
          <button className="footer-legal-link" onClick={nav("terms")}>Terms</button>
          <button className="footer-legal-link" onClick={nav("contact")}>Contact</button>
          <button className="footer-legal-link" onClick={nav("about")}>About</button>
        </div>
      </div>
    </footer>
  );
}
