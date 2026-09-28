import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { App } from "./App.js";
import "./styles.css";

// Messaggi di validazione in italiano: lo schema è quello condiviso con il server.
z.config(z.locales.it());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
