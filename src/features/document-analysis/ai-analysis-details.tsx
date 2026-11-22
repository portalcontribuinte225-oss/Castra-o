import type { AnyRecord } from "../../types";

// What the automatic analysis said about a document: the provider, its confidence and each criterion it checked.
export function AiAnalysisDetails({ show, provider, model, confidence, criteriaResults, metaClassName = "doc-row-meta", criteriaClassName = "doc-criteria-results", showMeta = true }: AnyRecord) {
  if (!show) return null;
  const numericConfidence = Number(confidence);
  const hasConfidence = Number.isFinite(numericConfidence);
  const providerLabel = [provider, model].filter(Boolean).join(" / ");
  const results = Array.isArray(criteriaResults) ? criteriaResults : [];

  return (
    <>
      {showMeta && (providerLabel || hasConfidence) && (
        <small className={metaClassName}>
          {[providerLabel, hasConfidence ? `${Math.round(numericConfidence * 100)}% de confiança` : ""].filter(Boolean).join(" · ")}
        </small>
      )}
      {results.length > 0 && (
        <div className={criteriaClassName}>
          {results.map((item: AnyRecord, index: number) => (
            <span key={`${item.criterion}-${index}`} className={item.met ? "is-met" : "is-missing"} title={item.reason || ""}>
              {item.criterion}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
