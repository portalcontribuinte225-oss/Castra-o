export const PDF_BASE_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; color: #172026; font-family: Arial, sans-serif; background: #ffffff; }
  .pdf-header { background: #10364f; color: #ffffff; border-radius: 14px; padding: 18px; display: flex; justify-content: space-between; gap: 18px; }
  .section-title, .header-box span, .data-item span { font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  h1 { margin: 4px 0 0; font-size: 22px; }
  .header-box { min-width: 130px; border: 1px solid rgba(255,255,255,.28); border-radius: 10px; padding: 10px; text-align: right; }
  .header-box strong { display: block; margin-top: 4px; font-size: 16px; }
  .section { margin-top: 14px; border: 1px solid #dbeaf3; border-radius: 12px; padding: 14px; }
  .section-title { color: #10364f; margin-bottom: 10px; }
  .data-grid { display: grid; gap: 8px; }
  .data-grid.three { grid-template-columns: repeat(3, 1fr); }
  .data-grid.four { grid-template-columns: repeat(4, 1fr); }
  .data-item { border: 1px solid #e8f1f5; border-radius: 8px; background: #f8fbfd; padding: 8px; }
  .data-item span { display: block; color: #64748b; margin-bottom: 4px; }
  .data-item strong { font-size: 12px; }
  .animal-card { margin-top: 10px; border: 1px solid #dbe5f1; border-radius: 10px; padding: 10px; background: #f8fafc; }
  .animal-card-title { color: #0f172a; font-weight: 800; margin-bottom: 8px; }
  .footer { margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #64748b; font-size: 10px; }
  @page { size: A4; margin: 12mm; }
  .pdf-page { page-break-after: always; min-height: 250mm; display: flex; flex-direction: column; }
  .pdf-page:last-child { page-break-after: auto; }
  .compact-header { padding: 13px 14px; border-radius: 10px; }
  .compact-header h1 { font-size: 18px; }
  .compact-header .header-box { padding: 8px; }
  .compact-section { margin-top: 8px; padding: 9px; border-radius: 9px; }
  .compact-four { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
  .compact-four .data-item { min-height: 36px; padding: 5px 6px; border-radius: 6px; }
  .compact-four .data-item span { margin-bottom: 2px; font-size: 7px; }
  .compact-four .data-item strong { font-size: 9px; line-height: 1.18; word-break: break-word; }
  .pdf-page--compact .animal-card { margin-top: 6px; padding: 7px; border-radius: 8px; }
  .pdf-page--compact .animal-card-title { margin-bottom: 5px; font-size: 10px; }
  .declaration-page { justify-content: space-between; }
  .declaration-document { color: #111827; font-size: 12px; line-height: 1.45; }
  .declaration-document h1, .declaration-document h2 { margin: 0; text-align: center; font-weight: 800; letter-spacing: .02em; }
  .declaration-document h1 { margin-top: 12px; font-size: 18px; }
  .declaration-document h2 { margin-top: 4px; font-size: 16px; }
  .declaration-lead { margin: 28px 0 14px; font-weight: 700; }
  .responsibility-list { margin: 0; padding-left: 22px; }
  .responsibility-list > li { margin-bottom: 8px; }
  .recommendation-list { margin-top: 7px; padding-left: 18px; }
  .recommendation-list > li { margin-bottom: 4px; }
`;

export function printHtmlViaIframe(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const cleanup = () => setTimeout(() => iframe.remove(), 300);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 30000);
  };
  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  try {
    doc.open();
    doc.write(html);
    doc.close();
  } catch {
    iframe.remove();
  }
}
