// ─────────────────────────────────────────────────────────────
// PRODUCT FORM
// Used for both "Add new product" and "Edit product".
// Performs live validation on blur and on submit.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { validateProduct, validateField, ALLOWED_CATEGORIES, LIMITS } from "../data/validators";
import { AVAILABLE_SIZES } from "../data/tokens";
import { OrnamentIcon } from "./Shared";
import "../styles/components.css";

// Categories come from validators.js (single source of truth)
const CATEGORIES = ALLOWED_CATEGORIES;

const EMPTY_FORM = {
  name: "", price: "", stock: "",
  category: "Tops",
  colors: [""], sizes: [],
  description: "", features: [""],
  image: "",
};

export default function ProductForm({ initial, onSave, onCancel, title }) {
  // Pre-fill with existing product data when editing
  const [form, setForm] = useState(() =>
    initial
      ? {
          ...initial,
          category: initial.category || "Tops",
          price:    String(initial.price),
          stock:    String(initial.stock),
          colors:   initial.colors.length  ? [...initial.colors]   : [""],
          features: initial.features?.length ? [...initial.features] : [""],
        }
      : EMPTY_FORM
  );

  const [errors,  setErrors]  = useState({});
  const [touched, setTouched] = useState({});

  // Generic field setter
  const set = (field) => (value) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Validate a single field after user leaves it
  const handleBlur = (field) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    const payload = buildPayload();
    const err = validateField(field, payload);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  // Validate the whole form and show all errors at once
  const handleColorsBlur = () => {
    setTouched((t) => ({ ...t, colors: true }));
    const payload = buildPayload();
    const err = validateField("colors", payload);
    setErrors((prev) => ({ ...prev, colors: err }));
  };
  const handleSizesBlur = () => {
    setTouched((t) => ({ ...t, sizes: true }));
    const payload = buildPayload();
    const err = validateField("sizes", payload);
    setErrors((prev) => ({ ...prev, sizes: err }));
  };

  // Strip empty entries and coerce numeric fields before validating
  const buildPayload = () => ({
    ...form,
    price:    parseFloat(form.price),
    stock:    parseInt(form.stock, 10),
    colors:   form.colors.filter((c) => c.trim()),
    features: form.features.filter((f) => f.trim()),
  });

  const handleSubmit = () => {
    // Mark every field as touched so all errors appear at once
    const allTouched = Object.fromEntries(
      Object.keys(EMPTY_FORM).map((k) => [k, true])
    );
    setTouched(allTouched);

    const payload = buildPayload();
    const { valid, errors: errs } = validateProduct(payload);
    setErrors(errs);

    if (valid) onSave(payload);
  };

  // ── Color list helpers ─────────────────────────────────────
  const updateColor = (i, val) => {
    const arr = [...form.colors];
    arr[i] = val;
    set("colors")(arr);
  };
  const removeColor = (i) => set("colors")(form.colors.filter((_, j) => j !== i));
  const addColor    = ()  => set("colors")([...form.colors, ""]);

  // ── Feature list helpers ───────────────────────────────────
  const updateFeature = (i, val) => {
    const arr = [...form.features];
    arr[i] = val;
    set("features")(arr);
  };
  const removeFeature = (i) => set("features")(form.features.filter((_, j) => j !== i));
  const addFeature    = ()  => set("features")([...form.features, ""]);

  // ── Size toggle ────────────────────────────────────────────
  const toggleSize = (s) => {
    const has = form.sizes.includes(s);
    set("sizes")(has ? form.sizes.filter((x) => x !== s) : [...form.sizes, s]);
  };

  return (
    <div className="form-card">
      <OrnamentIcon />
      <h3 className="form-title">{title}</h3>

      {/* Name */}
      <label className="form-label">PRODUCT NAME</label>
      <input
        className={`form-input ${errors.name && touched.name ? "form-input--error" : ""}`}
        value={form.name}
        onChange={(e) => set("name")(e.target.value)}
        onBlur={handleBlur("name")}
        placeholder="e.g. Oxford Regular"
      />
      {errors.name && touched.name && (
        <p className="form-error">{errors.name}</p>
      )}

      {/* Category */}
      <label className="form-label">CATEGORY</label>
      <select
        className="form-input"
        value={form.category || "Tops"}
        onChange={(e) => set("category")(e.target.value)}
        style={{ appearance: "none", cursor: "pointer" }}
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c} style={{ background: "#141414", color: "#f0ebe0" }}>{c}</option>
        ))}
      </select>

      {/* Price + Stock side by side */}
      <div className="form-grid-2">
        <div>
          <label className="form-label">PRICE ($)</label>
          <input
            className={`form-input ${errors.price && touched.price ? "form-input--error" : ""}`}
            type="number" min="0" step="0.01"
            value={form.price}
            onChange={(e) => set("price")(e.target.value)}
            onBlur={handleBlur("price")}
            placeholder="0.00"
          />
          {errors.price && touched.price && (
            <p className="form-error">{errors.price}</p>
          )}
        </div>
        <div>
          <label className="form-label">STOCK QTY</label>
          <input
            className={`form-input ${errors.stock && touched.stock ? "form-input--error" : ""}`}
            type="number" min="0" step="1"
            value={form.stock}
            onChange={(e) => set("stock")(e.target.value)}
            onBlur={handleBlur("stock")}
            placeholder="0"
          />
          {errors.stock && touched.stock && (
            <p className="form-error">{errors.stock}</p>
          )}
        </div>
      </div>

      {/* Image URL */}
      <label className="form-label">IMAGE URL (optional)</label>
      <input
        className={`form-input ${errors.image && touched.image ? "form-input--error" : ""}`}
        value={form.image}
        onChange={(e) => set("image")(e.target.value)}
        onBlur={handleBlur("image")}
        placeholder="https://..."
      />
      {errors.image && touched.image && (
        <p className="form-error">{errors.image}</p>
      )}

      {/* Colors */}
      <label className="form-label">COLORS</label>
      {form.colors.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            value={c}
            onChange={(e) => updateColor(i, e.target.value)}
            onBlur={handleColorsBlur}
            placeholder="e.g. Blue"
            maxLength={LIMITS.colorName.max}
          />
          {form.colors.length > 1 && (
            <button className="form-remove-btn" onClick={() => removeColor(i)}>×</button>
          )}
        </div>
      ))}
      <button className="form-add-btn" onClick={addColor}>+ ADD COLOR</button>
      {errors.colors && touched.colors && (
        <p className="form-error">{errors.colors}</p>
      )}

      {/* Sizes */}
      <label className="form-label">SIZES</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        {AVAILABLE_SIZES.map((s) => (
          <button
            key={s}
            className={`size-toggle ${form.sizes.includes(s) ? "size-toggle--active" : ""}`}
            onClick={() => { toggleSize(s); handleSizesBlur(); }}
          >
            {s}
          </button>
        ))}
      </div>
      {errors.sizes && touched.sizes && (
        <p className="form-error">{errors.sizes}</p>
      )}

      {/* Description */}
      <label className="form-label">DESCRIPTION</label>
      <textarea
        className={`form-input ${errors.description && touched.description ? "form-input--error" : ""}`}
        style={{ minHeight: 80, resize: "vertical" }}
        value={form.description}
        onChange={(e) => set("description")(e.target.value)}
        onBlur={handleBlur("description")}
        placeholder="Product description…"
      />
      <p style={{
        fontSize: 11,
        color: (form.description || "").length > 480
          ? "#c05050"
          : "rgba(201,168,76,0.4)",
        fontFamily: "'Montserrat', sans-serif", marginTop: 4,
      }}>
        {(form.description || "").length}/{LIMITS.description.max}
      </p>
      {errors.description && touched.description && (
        <p className="form-error">{errors.description}</p>
      )}

      {/* Features */}
      <label className="form-label">FEATURES (bullet points)</label>
      {form.features.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            value={f}
            onChange={(e) => updateFeature(i, e.target.value)}
            onBlur={handleBlur("features")}
            placeholder="e.g. 100% cotton"
            maxLength={LIMITS.featureText.max}
          />
          {form.features.length > 1 && (
            <button className="form-remove-btn" onClick={() => removeFeature(i)}>×</button>
          )}
        </div>
      ))}
      <button className="form-add-btn" onClick={addFeature}>+ ADD FEATURE</button>
      {errors.features && touched.features && (
        <p className="form-error">{errors.features}</p>
      )}

      {/* Footer buttons */}
      <div className="form-footer">
        <button className="btn-cancel" onClick={onCancel}>CANCEL</button>
        <button className="btn-save"   onClick={handleSubmit}>SAVE PRODUCT</button>
      </div>
    </div>
  );
}
