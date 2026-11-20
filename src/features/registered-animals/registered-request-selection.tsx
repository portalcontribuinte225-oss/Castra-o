import { Card } from "../../components/card";
import { maskCpf } from "../../utils";
import { maskFollowUpEmail, maskFollowUpPhone } from "../request-follow-up/follow-up";
import type { RegisteredRequestContext } from "./registered-animal-types";
import { AnimalTutorship } from "../../../shared/request-tutorship-contract.js";

// What the registered animal was made with. Anything else is blocked by the server, which says why above the summary.
const tutorshipLabels: Record<string, string> = { [AnimalTutorship.WITH_TUTOR]: "Animal com tutor", [AnimalTutorship.WITHOUT_TUTOR]: "Animal sem tutor" };

export function RegisteredRequestSelection({ context, selectedType, onSelectType }: { context: RegisteredRequestContext; selectedType: string; onSelectType: (name: string) => void }) {
  const { animal, tutor } = context;
  return (
    <div className="registered-request-selection">
      <Card className="tw:grid tw:gap-3 tw:p-4 tw:text-ui-text">
        <h3 className="tw:m-0 tw:text-base tw:font-semibold tw:text-ui-ink">{animal.name || "Animal sem nome"}</h3>
        <dl className="tw:m-0 tw:grid tw:gap-x-4 tw:gap-y-1.5 tw:text-sm tw:sm:grid-cols-[max-content_minmax(0,1fr)] tw:[&>dt]:font-medium tw:[&>dd]:m-0 tw:[&>dd]:break-words">
          <dt>Espécie</dt><dd>{animal.species || "Não informada"}</dd>
          <dt>Raça</dt><dd>{animal.breedDescription || animal.breed || animal.breedType || "Não informada"}</dd>
          <dt>Identificação</dt><dd>{tutorshipLabels[animal.tutorship || AnimalTutorship.WITH_TUTOR] || "A conferir"}</dd>
          <dt>Microchip</dt><dd>{animal.confirmedMicrochip ? `${animal.confirmedMicrochip} (confirmado)` : animal.declaredMicrochip ? `${animal.declaredMicrochip} (informado, aguarda conferência)` : "Sem microchip"}</dd>
          <dt>Tutor</dt><dd>{tutor.name || tutor.tutor} · {maskCpf(tutor.cpf)}</dd>
          <dt>Contato cadastral</dt><dd>{[maskFollowUpEmail(tutor.email || ""), maskFollowUpPhone(tutor.phone || "")].filter(Boolean).join(" · ") || "Não informado"}</dd>
        </dl>
        <p className="tw:m-0 tw:text-sm">Os dados do cadastro são somente para leitura. Se precisar corrigi-los, procure o atendimento.</p>
      </Card>
      {context.eligibility?.canSubmit === false && <p className="form-error" role="alert">{context.eligibility.reason || "Este cadastro precisa de conferência antes de um novo pedido."}</p>}
      <fieldset className="tw:m-0 tw:grid tw:min-w-0 tw:gap-2 tw:border-0 tw:p-0">
        <legend className="tw:mb-2 tw:text-sm tw:font-semibold tw:text-ui-ink">O que deseja solicitar?</legend>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {context.requestTypes.filter((type) => type.active !== false).map((type) => (
            <Card
              as="button"
              key={type.id}
              aria-pressed={selectedType === type.name}
              className="tw:min-h-11 tw:px-4 tw:text-sm tw:font-semibold tw:text-ui-ink tw:hover:border-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent"
              onClick={() => onSelectType(type.name)}
            >
              {type.name}
            </Card>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
