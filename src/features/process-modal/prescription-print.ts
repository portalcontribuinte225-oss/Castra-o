import { displayText, getItemMunicipalityId, normalizeRequest } from "../../domain";
import type { AnyRecord } from "../../types";
import { escapeHtml, formatCep, normalizeText } from "../../utils";
import { formatMunicipalityAddress } from "../municipality-form/municipality-address";
import { PDF_BASE_STYLES } from "../process-report/print-html";

export function getPrescriptionMunicipality(request: AnyRecord = {}, municipalities: AnyRecord[] = []) {
  const normalizedRequest = normalizeRequest(request);
  const municipalityId = normalizedRequest.municipalityId || getItemMunicipalityId(request);
  const municipalityName = normalizedRequest.municipalityName || normalizedRequest.scheduleMunicipality || "";
  return municipalities.find((item) => String(item.id || "") === String(municipalityId || ""))
    || municipalities.find((item) => normalizeText(item.name || "") === normalizeText(municipalityName))
    || { name: municipalityName };
}

function buildPrescriptionInstitutionName(municipality: AnyRecord = {}, request: AnyRecord = {}) {
  const normalizedRequest = normalizeRequest(request);
  const name = displayText(municipality.name || normalizedRequest.municipalityName || normalizedRequest.scheduleMunicipality || "");
  if (!name) return "Sistema Municipal de Bem-Estar Animal";
  return /^prefeitura/i.test(name) ? name : `Prefeitura Municipal de ${name}`;
}

function buildPrescriptionFooterLines(municipality: AnyRecord = {}) {
  const location = [formatMunicipalityAddress(municipality), municipality.cep ? `CEP ${formatCep(municipality.cep)}` : ""].filter(Boolean).join(" - ");
  const contact = [municipality.contact, municipality.email].filter(Boolean).join(" | ");
  return [location, contact].filter(Boolean);
}

export function buildPrescriptionPrintHtml(request: AnyRecord, prescription: { text: string; professionalName: string; professionalRegistry: string }, municipality: AnyRecord, animal: AnyRecord, procedureName: string, issuedAt?: string) {
  const normalizedRequest = normalizeRequest(request);
  const microchip = animal.confirmedMicrochip || animal.microchip || "";
  const institutionName = buildPrescriptionInstitutionName(municipality, normalizedRequest);
  const municipalityName = displayText(municipality.name || normalizedRequest.municipalityName || normalizedRequest.scheduleMunicipality || "");
  const footerLines = buildPrescriptionFooterLines(municipality);
  const logo = municipality.brasao
    ? `<img class="rx-logo" src="${escapeHtml(municipality.brasao)}" alt="Brasão" />`
    : `<div class="rx-logo-fallback">SM</div>`;
  const animalLine = [animal.name || "Animal sem nome", animal.species, animal.sex, microchip ? `Chip: ${microchip}` : ""].filter(Boolean).join(" · ");
  const prescriptionHtml = escapeHtml(prescription.text).replace(/\n/g, "<br />");
  const issueDate = new Date(issuedAt || Date.now()).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receita Veterinária${normalizedRequest.protocol ? ` - ${escapeHtml(normalizedRequest.protocol)}` : ""}</title>
    <style>
      ${PDF_BASE_STYLES}
      body { padding: 26px; }
      .rx-page { min-height: calc(100vh - 52px); display: flex; flex-direction: column; }
      .rx-header { display: grid; grid-template-columns: 64px 1fr auto; align-items: center; gap: 14px; padding-bottom: 16px; border-bottom: 1px solid #dbeaf3; }
      .rx-logo, .rx-logo-fallback { width: 56px; height: 56px; object-fit: contain; }
      .rx-logo-fallback { display: grid; place-items: center; border: 1px solid #dbeaf3; border-radius: 12px; color: #0f5132; font-weight: 800; background: #f8fafc; }
      .rx-heading h1 { margin: 0; font-size: 21px; color: #172026; }
      .rx-heading p { margin: 4px 0 0; color: #64748b; font-size: 11px; }
      .rx-protocol { min-width: 132px; border: 1px solid #c9efd7; background: #eefbf3; border-radius: 10px; padding: 9px 11px; text-align: right; color: #0f5132; }
      .rx-protocol span { display: block; font-size: 8px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
      .rx-protocol strong { display: block; margin-top: 3px; font-size: 13px; }
      .rx-patient { margin-top: 18px; color: #334155; font-size: 12px; line-height: 1.5; }
      .rx-patient strong { color: #172026; }
      .rx-symbol { margin-top: 30px; font-family: Georgia, serif; font-size: 38px; font-weight: 800; font-style: italic; color: #15803d; line-height: 1; }
      .rx-prescription { margin-top: 8px; padding-top: 16px; border-top: 1px solid #dbeaf3; color: #172026; font-size: 14px; line-height: 1.75; white-space: normal; }
      .rx-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid #dbeaf3; display: flex; justify-content: space-between; gap: 16px; color: #64748b; font-size: 10px; }
      .rx-footer span { display: block; }
      @media print { body { padding: 0; } .rx-page { min-height: 100vh; } }
    </style>
  </head>
  <body>
    <main class="rx-page">
      <header class="rx-header">
        ${logo}
        <div class="rx-heading">
          <h1>${escapeHtml(institutionName)}</h1>
          <p>Receita Veterinária${municipalityName ? ` · ${escapeHtml(municipalityName)}` : ""}</p>
        </div>
        <div class="rx-protocol"><span>Protocolo</span><strong>${escapeHtml(normalizedRequest.protocol ? `#${normalizedRequest.protocol}` : "-")}</strong></div>
      </header>

      <section class="rx-patient">
        <div><strong>Paciente:</strong> ${escapeHtml(animalLine || "Animal sem nome")}</div>
        <div><strong>Tutor:</strong> ${escapeHtml(normalizedRequest.tutor || "-")}</div>
        <div><strong>Procedimento:</strong> ${escapeHtml(procedureName || "-")}</div>
      </section>

      <section>
        <div class="rx-symbol">Rx</div>
        <div class="rx-prescription">${prescriptionHtml || "-"}</div>
      </section>

      <footer class="rx-footer">
        <div>
          <span>${escapeHtml(footerLines[0] || "Sistema Municipal de Bem-Estar Animal")}</span>
          <span>${escapeHtml(footerLines[1] || "Receita emitida pelo sistema municipal")}</span>
        </div>
        <div>
          <span><strong>${escapeHtml(prescription.professionalName)}</strong></span>
          <span>${escapeHtml(prescription.professionalRegistry)} · Emitido em ${issueDate}</span>
        </div>
      </footer>
    </main>
  </body>
</html>`;
}
