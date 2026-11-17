import { useState } from "react";

// Makes the request document (a PDF, as a data URL) when the person asks for it, and saves it as "Requerimento <protocol>.pdf".
export function useRequirementDownload(createRequirement: () => Promise<string>, protocol: string) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      const anchor = window.document.createElement("a");
      anchor.href = await createRequirement();
      anchor.download = `Requerimento ${protocol}.pdf`.trim();
      anchor.click();
    } catch (failure) {
      console.error("Erro ao gerar requerimento:", failure);
      setError("Não foi possível gerar o requerimento agora. Tente novamente em instantes.");
    } finally {
      setDownloading(false);
    }
  }

  return { downloading, error, download };
}
