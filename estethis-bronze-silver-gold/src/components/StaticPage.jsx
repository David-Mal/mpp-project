// ─────────────────────────────────────────────────────────────
// STATIC PAGE
// Handles three informational pages — About Us, Contact, and
// Terms & Conditions — via a `type` prop. Each uses the same
// dark/gold layout shell but renders its own content section.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { Logo, GoldDivider } from "./Shared";
import Footer from "./Footer";
import "../styles/account.css";

// ── About Us ─────────────────────────────────────────────────
function AboutContent() {
  return (
    <>
      <div className="static-pillars">
        <div className="static-pillar">
          <div className="static-pillar__num">01</div>
          <div className="static-pillar__title">CRAFTSMANSHIP</div>
          <p className="static-pillar__desc">
            Every garment in our collection is the result of hundreds of hours of
            meticulous work by artisans who have honed their craft across generations.
            We source only the finest materials — hand-selected silks, Italian wools,
            and rare cashmere — to ensure that each piece endures.
          </p>
        </div>
        <div className="static-pillar">
          <div className="static-pillar__num">02</div>
          <div className="static-pillar__title">HERITAGE</div>
          <p className="static-pillar__desc">
            Founded in 2014, Estethis draws its philosophy from the grand ateliers of
            Paris and Milan. Our founders spent a decade studying under legendary
            couturiers before returning to establish a house that bridges classical
            technique with contemporary sensibility.
          </p>
        </div>
        <div className="static-pillar">
          <div className="static-pillar__num">03</div>
          <div className="static-pillar__title">SUSTAINABILITY</div>
          <p className="static-pillar__desc">
            Luxury and responsibility are not opposing forces. We operate with a
            commitment to zero-waste pattern-making, ethically compensated ateliers,
            and packaging that is entirely biodegradable. Beauty should never come
            at the expense of the world we inhabit.
          </p>
        </div>
      </div>

      <div className="static-section">
        <p className="static-section-title">OUR STORY</p>
        <div className="static-text">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque
            habitant morbi tristique senectus et netus et malesuada fames ac turpis
            egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor
            sit amet, ante. Donec eu libero sit amet quam egestas semper.
          </p>
          <p>
            Aenean ultricies mi vitae est. Mauris placerat eleifend leo. Quisque sit
            amet est et sapien ullamcorper pharetra. Vestibulum erat wisi, condimentum
            sed, commodo vitae, ornare sit amet, wisi. Aenean fermentum, elit eget
            tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim
            ac dui. Donec non enim in turpis pulvinar facilisis.
          </p>
          <p>
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi
            ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit
            in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
            sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
            mollit anim id est laborum.
          </p>
        </div>
      </div>

      <div className="static-section">
        <p className="static-section-title">THE ATELIER</p>
        <div className="static-text">
          <p>
            Our primary atelier is located in the historic textile district of
            Florence, Italy, occupying a 19th-century palazzo that has been carefully
            restored to serve as both a working studio and a showroom. A secondary
            atelier in New York handles the bespoke commissions that arrive from our
            North American clientele.
          </p>
          <p>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
            doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
            veritatis et quasi architecto beatae vitae dicta sunt explicabo.
          </p>
        </div>
      </div>
    </>
  );
}

// ── Contact ──────────────────────────────────────────────────
function ContactContent({ isAdmin, onSendMessage }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    const msg = {
      id:      (globalThis.crypto?.randomUUID?.()) || `msg-${Date.now()}`,
      name:    form.name.trim(),
      email:   form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
      sentAt:  new Date().toISOString(),
      read:    false,
    };
    onSendMessage?.(msg);
    setSent(true);
  };

  const infoColumn = (
    <div className="contact-info">
      <div className="contact-info-item">
        <span className="contact-info-label">HEADQUARTERS</span>
        <span className="contact-info-value">
          Via della Vigna Nuova, 18<br />
          50123 Florence, Italy
        </span>
      </div>
      <div className="contact-info-item">
        <span className="contact-info-label">NEW YORK ATELIER</span>
        <span className="contact-info-value">
          420 West 14th Street, Suite 301<br />
          New York, NY 10014
        </span>
      </div>
      <div className="contact-info-item">
        <span className="contact-info-label">EMAIL</span>
        <span className="contact-info-value">hello@estethis.com</span>
      </div>
      <div className="contact-info-item">
        <span className="contact-info-label">CLIENT SERVICES</span>
        <span className="contact-info-value">+1 (212) 555-0174</span>
      </div>
      <div className="contact-info-item">
        <span className="contact-info-label">HOURS</span>
        <span className="contact-info-value">
          Monday – Friday: 9:00 – 18:00 CET<br />
          Saturday: 10:00 – 15:00 CET
        </span>
      </div>
    </div>
  );

  return (
    <div className="contact-grid">
      {infoColumn}

      {/* Form column — admin sees a notice instead of the form */}
      {isAdmin ? (
        <div className="contact-admin-notice">
          <div className="contact-admin-notice__icon">✉</div>
          <p className="contact-admin-notice__title">Administrator View</p>
          <p className="contact-admin-notice__text">
            Contact form submissions from visitors are stored in the Admin Panel.
            Navigate to <strong>Statistics → Inbox</strong> to read and manage messages.
          </p>
        </div>
      ) : (
        <form className="contact-form" onSubmit={handleSubmit}>
          {sent ? (
            <p className="contact-sent">
              ✓ &nbsp;Thank you for reaching out. A member of our team will respond within 24 hours.
            </p>
          ) : (
            <>
              <div className="contact-field">
                <label className="contact-label">YOUR NAME</label>
                <input className="contact-input" value={form.name} onChange={set("name")}
                  placeholder="Full name" required />
              </div>
              <div className="contact-field">
                <label className="contact-label">EMAIL ADDRESS</label>
                <input className="contact-input" type="email" value={form.email} onChange={set("email")}
                  placeholder="you@example.com" required />
              </div>
              <div className="contact-field">
                <label className="contact-label">SUBJECT</label>
                <input className="contact-input" value={form.subject} onChange={set("subject")}
                  placeholder="Order enquiry, bespoke consultation…" />
              </div>
              <div className="contact-field">
                <label className="contact-label">MESSAGE</label>
                <textarea className="contact-textarea" value={form.message} onChange={set("message")}
                  placeholder="Write your message here…" required />
              </div>
              <button type="submit" className="contact-submit">SEND MESSAGE</button>
            </>
          )}
        </form>
      )}
    </div>
  );
}

// ── Terms & Conditions ────────────────────────────────────────
function TermsContent() {
  const sections = [
    {
      title: "ACCEPTANCE OF TERMS",
      body: `By accessing and placing an order with Estethis, you confirm that you are in
agreement with and bound by the terms and conditions contained herein. These terms apply
to the entire website and any email or other type of communication between you and
Estethis. Under no circumstances shall the Estethis team be liable for any direct,
indirect, special, incidental or consequential damages, including, but not limited to,
loss of data or profit, arising out of the use, or the inability to use, the materials
on this site, even if the Estethis team or an authorised representative has been
advised of the possibility of such damages.`,
    },
    {
      title: "PRODUCTS & PRICING",
      body: `All prices on the Estethis platform are displayed in United States Dollars (USD)
unless otherwise stated. We reserve the right to modify pricing at any time without prior
notice. Estethis makes every effort to display the colours of our garments as accurately
as possible; however, we cannot guarantee that your monitor's display of any colour will
be perfectly accurate. Product availability is subject to change. In the event that a
product you have ordered becomes unavailable, we will notify you and offer a full refund
or an alternative of equal value.`,
    },
    {
      title: "ORDERS & PAYMENT",
      body: `When you place an order through the Estethis platform, you are making an offer to
purchase. All orders are subject to acceptance and availability. The checkout process on
this platform is for demonstration purposes only. No real financial transactions are
processed. In a production environment, payment would be processed via a PCI-DSS
compliant payment gateway. We accept all major credit and debit cards, as well as
PayPal and selected wire transfer arrangements for bespoke orders exceeding $2,000.`,
    },
    {
      title: "SHIPPING & DELIVERY",
      body: `Standard shipping is fulfilled within 5–7 business days to most destinations worldwide.
Express shipping (1–2 business days) is available for an additional fee. All orders
include complimentary signature confirmation and are dispatched in our bespoke gift
packaging. We are not responsible for delays caused by customs clearance procedures in
the destination country. Any applicable import duties, taxes, or customs fees are the
sole responsibility of the recipient.`,
    },
    {
      title: "RETURNS & EXCHANGES",
      body: `We accept returns within 30 days of delivery, provided the garment is unworn, unwashed,
and returned with all original tags attached. To initiate a return, please contact our
Client Services team. Bespoke and made-to-measure items are not eligible for return
unless there is a manufacturing defect. Shipping costs for returns are the responsibility
of the customer, with the exception of items returned due to a quality defect, for which
we provide a pre-paid return label.`,
    },
    {
      title: "PRIVACY & DATA",
      body: `Estethis is committed to protecting your personal information. We collect only the data
necessary to process your orders and improve our services. Your information is never sold
to third parties. We employ industry-standard encryption for all data transmissions and
payment information. You have the right to request a copy of all personal data we hold
about you, and the right to request its deletion, in accordance with applicable data
protection legislation. For full details, please refer to our Privacy Policy.`,
    },
  ];

  return (
    <>
      <div className="static-section">
        <div className="static-text">
          <p>
            Please read these Terms and Conditions carefully before using the Estethis
            platform. By accessing our services, you agree to be legally bound by these
            terms. If you do not agree with any part of these terms, you may not use our
            services. These terms were last updated in June 2026.
          </p>
        </div>
      </div>

      <div className="terms-list">
        {sections.map((s, i) => (
          <div key={i} className="terms-list-item">
            <p className="static-section-title">{s.title}</p>
            <div className="static-text">
              <p>{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Config by page type ───────────────────────────────────────
const PAGE_CONFIG = {
  about: {
    eyebrow:  "ESTETHIS · EST. 2014",
    title:    "The Art of\nElegance",
    lead:     "We believe that true luxury is not defined by price, but by intention — the care with which a garment is conceived, the skill with which it is made, and the story it carries for those who wear it.",
    Content:  AboutContent,
  },
  contact: {
    eyebrow:  "GET IN TOUCH",
    title:    "We'd Love\nto Hear From You",
    lead:     "Whether you have a question about an order, wish to arrange a private consultation, or simply want to share your thoughts — our team is always delighted to hear from you.",
    Content:  ContactContent,
  },
  terms: {
    eyebrow:  "LEGAL",
    title:    "Terms &\nConditions",
    lead:     "Your use of the Estethis platform is subject to the following terms. We encourage you to read them carefully.",
    Content:  TermsContent,
  },
};

// ── Main component ────────────────────────────────────────────
export default function StaticPage({ type, onBack, onNavigate, currentUser, onSendMessage }) {
  const config = PAGE_CONFIG[type] ?? PAGE_CONFIG.about;
  const { eyebrow, title, lead, Content } = config;
  const isAdmin = currentUser?.role === 'admin';

  const [titleLine1, titleLine2] = title.split("\n");

  return (
    <div className="static-page page-enter">

      {/* Nav */}
      <div className="static-nav">
        <Logo onClick={onBack} />
        <button className="nav-btn nav-btn--ghost" onClick={onBack}>← BACK</button>
      </div>
      <GoldDivider style={{ width: "100%" }} />

      {/* Hero */}
      <div className="static-hero">
        <p className="static-eyebrow">{eyebrow}</p>
        <h1 className="static-title">
          {titleLine1}<br />
          <span style={{ color: "#c9a84c" }}>{titleLine2}</span>
        </h1>
        <p className="static-lead">{lead}</p>
      </div>

      <GoldDivider style={{ width: "100%", opacity: 0.4 }} />

      {/* Body — pass admin/message props; non-Contact pages ignore them */}
      <div className="static-body">
        <Content isAdmin={isAdmin} onSendMessage={onSendMessage} />
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
