// ─────────────────────────────────────────────────────────────
// DETAIL VIEW
// Full-screen two-column product detail page.
// Left: product info, colors, sizes, features.
// Right: main image + thumbnail strip.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { Logo, GoldDivider } from "./Shared";
import ReviewsPanel from "./ReviewsPanel";
import "../styles/components.css";

// Extra thumbnail images to fill the strip (reuses unsplash)
const EXTRA_THUMBS = [
  "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=100&q=60",
  "https://images.unsplash.com/photo-1604695573706-53170668f6a6?w=100&q=60",
];

export default function DetailView({ product, onBack, onEdit, onDelete, onAtelier, online }) {
  const [selectedColor, setSelectedColor] = useState(product.colors[0] || "");
  const [selectedSize,  setSelectedSize]  = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mainImg,       setMainImg]       = useState(product.image);

  // Build thumbnail array from product image + extras
  const thumbs = [product.image, ...EXTRA_THUMBS].slice(0, 3);

  // Split product name into two display lines
  const words     = product.name.split(" ");
  const nameLine1 = words[0] || "";
  const nameLine2 = words.slice(1).join(" ") || "";

  return (
    <div className="detail page-enter">

      {/* ── Header ── */}
      <div className="detail__header">
        <Logo onClick={onBack} />

        <div className="detail__actions">
          <button className="nav-btn nav-btn--ghost" onClick={onBack}>← BACK</button>
          {onAtelier && (
            <button className="nav-btn nav-btn--gold" onClick={onAtelier}
              style={{ borderColor: "rgba(201,168,76,0.5)" }}>✦ ATELIER</button>
          )}
          <button className="nav-btn nav-btn--gold"  onClick={() => onEdit(product.id)}>EDIT</button>

          {!confirmDelete ? (
            <button className="nav-btn nav-btn--danger" onClick={() => setConfirmDelete(true)}>
              DELETE
            </button>
          ) : (
            <div className="confirm-delete">
              <span className="confirm-delete__label">CONFIRM?</span>
              <button
                className="nav-btn nav-btn--danger"
                onClick={() => onDelete(product.id)}
              >YES</button>
              <button
                className="nav-btn nav-btn--ghost"
                onClick={() => setConfirmDelete(false)}
              >NO</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body: two columns ── */}
      <div className="detail__body">

        {/* LEFT: product information */}
        <div className="detail__info">

          {/* Product name */}
          <div style={{ marginBottom: 32 }}>
            <h1 className="detail__name-line1">{nameLine1}</h1>
            {nameLine2 && <h2 className="detail__name-line2">{nameLine2}</h2>}
            <GoldDivider width={80} style={{ marginTop: 18 }} />
          </div>

          {/* Colors */}
          <div style={{ marginBottom: 22 }}>
            <span className="detail__attr-label">COLORS: </span>
            {product.colors.map((c, i) => (
              <span key={i}>
                <span
                  className={`detail__attr-value ${
                    selectedColor === c
                      ? "detail__attr-value--active"
                      : "detail__attr-value--inactive"
                  }`}
                  onClick={() => setSelectedColor(c)}
                >
                  {c}
                </span>
                {i < product.colors.length - 1 && (
                  <span className="detail__separator">/ </span>
                )}
              </span>
            ))}
          </div>

          {/* Sizes */}
          <div style={{ marginBottom: 22 }}>
            <span className="detail__attr-label">SIZES: </span>
            {product.sizes.map((s, i) => (
              <span key={i}>
                <span
                  className={`detail__attr-value ${
                    selectedSize === s
                      ? "detail__attr-value--active"
                      : "detail__attr-value--inactive"
                  }`}
                  onClick={() => setSelectedSize(s)}
                >
                  {s}
                </span>
                {i < product.sizes.length - 1 && (
                  <span className="detail__separator">/ </span>
                )}
              </span>
            ))}
          </div>

          {/* Price */}
          <div style={{ marginBottom: 28 }}>
            <span className="detail__attr-label">PRICE: </span>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              color: "#f0ebe0",
            }}>
              {product.price} $
            </span>
          </div>

          <GoldDivider width={200} />

          {/* Feature bullet list */}
          {product.features?.length > 0 && (
            <ul className="detail__features">
              {product.features.map((f, i) => (
                <li className="detail__feature" key={i}>
                  <span className="detail__feature-bullet">•</span>
                  {f}
                </li>
              ))}
            </ul>
          )}

          {/* Stock indicator */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: product.stock > 5 ? "#4a9a6a"
                        : product.stock > 0 ? "#c9a84c"
                        : "#c05050",
            }} />
            <span style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 9,
              letterSpacing: "0.18em",
              color: "rgba(240,235,224,0.4)",
            }}>
              {product.stock > 0 ? `${product.stock} IN STOCK` : "OUT OF STOCK"}
            </span>
          </div>
        </div>

        {/* RIGHT: images */}
        <div className="detail__images">
          <img
            className="detail__main-img"
            src={mainImg || product.image}
            alt={product.name}
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <div className="detail__thumbnails">
            {thumbs.map((img, i) => (
              <img
                key={i}
                className={`detail__thumb ${mainImg === img ? "detail__thumb--active" : ""}`}
                src={img}
                alt=""
                onClick={() => setMainImg(img)}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            ))}
          </div>
        </div>

      </div>

      {/* ── Reviews (Gold — 1-to-many) ── */}
      <ReviewsPanel productId={product.id} online={online} />

    </div>
  );
}
