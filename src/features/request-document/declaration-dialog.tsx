import { useEffect, useId, useRef } from "react";
import { CloseButton } from "../../components/close-button";
import { declarationIntro, renderDeclaration } from "./request-declaration";

// The declaration the tutor accepts on the web, as text on the screen: the same words the requirement prints.
export function DeclarationDialog({ municipalityName = "", tutorName = "", onClose }: { municipalityName?: string; tutorName?: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const { groups, recommendations } = renderDeclaration({ municipalityName });
  let clause = 0;
  const numberedGroups = groups.map((group) => ({ ...group, items: group.items.map((text) => ({ text, number: String(++clause).padStart(2, "0") })) }));

  useEffect(() => {
    const trigger = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    return () => { if (trigger instanceof HTMLElement) trigger.focus(); };
  }, []);

  return (
    <div className="modal-backdrop">
      <section
        ref={dialogRef}
        className="document-preview-modal tw:max-w-[720px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
      >
        <header className="tw:flex tw:items-start tw:justify-between tw:gap-3 tw:pt-3">
          <h2 id={titleId} className="tw:m-0 tw:min-w-0 tw:break-words tw:text-lg tw:font-semibold tw:text-ui-ink">Declaração de ciência e responsabilidades</h2>
          <CloseButton onClick={onClose} />
        </header>
        <div className="tw:grid tw:gap-4 tw:text-sm tw:leading-relaxed tw:text-ui-text">
          <p className="tw:m-0">{declarationIntro(tutorName)}</p>
          {numberedGroups.map((group, index) => (
            <section key={group.title} className="tw:grid tw:gap-2" aria-label={group.title}>
              <h3 className="tw:m-0 tw:text-sm tw:font-semibold tw:text-ui-ink">{`${String(index + 1).padStart(2, "0")} / ${group.title}`}</h3>
              <ol className="tw:m-0 tw:grid tw:list-none tw:gap-2 tw:p-0">
                {group.items.map(({ text, number }) => (
                  <li key={number} className="tw:flex tw:gap-2">
                    <span className="tw:shrink-0 tw:text-ui-muted" aria-hidden="true">{number}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {recommendations.length > 0 && (
            <section className="tw:grid tw:gap-2" aria-label="Orientações para o dia do atendimento">
              <h3 className="tw:m-0 tw:text-sm tw:font-semibold tw:text-ui-ink">Orientações para o dia do atendimento</h3>
              <p className="tw:m-0">{recommendations.join(" ")}</p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
