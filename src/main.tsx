import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {});

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem("castragestao:sw-refreshing") === "true") return;
      sessionStorage.setItem("castragestao:sw-refreshing", "true");
      window.location.reload();
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
