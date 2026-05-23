// ─────────────────────────────────────────────────────────────
// MAIN.JSX — Entry point
// Mounts the React app into index.html's <div id="root">.
// Import global CSS here so it applies to everything.
// ─────────────────────────────────────────────────────────────

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/index.css";
import "./styles/components.css";
import "./styles/animations.css";
import "./styles/silver.css";
import "./styles/gold.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);
