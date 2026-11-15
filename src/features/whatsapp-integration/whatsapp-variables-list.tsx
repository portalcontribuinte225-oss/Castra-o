import React from "react";
import { whatsappFieldLabels } from "../../../shared/whatsapp-templates-contract.js";

export const VARIABLES_LIST_LABEL = "Variáveis existentes no sistema";

// Consultation only: lists the data the system can put in a template. The value never changes, so nothing is selectable.
export function WhatsappVariablesList() {
  return (
    <label className="field whatsapp-variables-field">
      <select aria-label={VARIABLES_LIST_LABEL} value="" onChange={() => undefined}>
        <option value="">{VARIABLES_LIST_LABEL}</option>
        {Object.values(whatsappFieldLabels).map((label) => <option key={label} value={label}>{label}</option>)}
      </select>
    </label>
  );
}
