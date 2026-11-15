import React from "react";
import { whatsappFieldLabels } from "../../../shared/whatsapp-templates-contract.js";

// Consultation only: lists the data the system can put in a template, nothing here is selectable.
export function WhatsappVariablesList() {
  return (
    <details className="whatsapp-variables">
      <summary><span className="whatsapp-variables-label">Variáveis</span><span className="whatsapp-variables-trigger">Ver lista</span></summary>
      <ul>
        {Object.values(whatsappFieldLabels).map((label) => <li key={label}>{label}</li>)}
      </ul>
    </details>
  );
}
