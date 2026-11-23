import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { api } from "./api";
import { readAdoptionShareId } from "../shared/adoption-contract.js";

// A shared adoption link opens the public page on the animal as a visitor's, even in a browser that keeps a session.
if (readAdoptionShareId(window.location.pathname)) api.ignoreSavedSession();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
