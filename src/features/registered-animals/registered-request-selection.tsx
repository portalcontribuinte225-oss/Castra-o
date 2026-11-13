import React from "react";
import { maskCpf } from "../../utils";
import { maskFollowUpEmail, maskFollowUpPhone } from "../request-follow-up/follow-up";
import { resolveRegisteredIdentificationType } from "./registered-request-data";
import type { RegisteredRequestContext } from "./registered-animal-types";

export function RegisteredRequestSelection({ context, selectedType, onSelectType }: { context: RegisteredRequestContext; selectedType: string; onSelectType: (name: string) => void }) {
  const { animal, tutor } = context;
  const identification = resolveRegisteredIdentificationType(context.identificationTypes, animal);
  return <div className="registered-request-selection">
    <div className="registered-readonly-summary"><h3>{animal.name || "Animal sem nome"}</h3><dl><dt>Espécie</dt><dd>{animal.species || "Não informada"}</dd><dt>Raça</dt><dd>{animal.breedDescription || animal.breed || animal.breedType || "Não informada"}</dd><dt>Identificação</dt><dd>{identification?.name || "Tipo indisponível"}</dd><dt>Microchip</dt><dd>{animal.confirmedMicrochip ? `${animal.confirmedMicrochip} (confirmado)` : animal.declaredMicrochip ? `${animal.declaredMicrochip} (informado, aguarda conferência)` : "Sem microchip"}</dd><dt>Tutor</dt><dd>{tutor.name || tutor.tutor} · {maskCpf(tutor.cpf)}</dd><dt>Contato cadastral</dt><dd>{[maskFollowUpEmail(tutor.email || ""), maskFollowUpPhone(tutor.phone || "")].filter(Boolean).join(" · ") || "Não informado"}</dd></dl><p>Os dados do cadastro são somente para leitura. Se precisar corrigi-los, procure o atendimento.</p></div>
    {context.eligibility?.canSubmit === false && <p className="form-error" role="alert">{context.eligibility.reason || "Este cadastro precisa de conferência antes de um novo pedido."}</p>}
    {!identification || identification.active === false ? <p className="form-error" role="alert">O tipo de identificação deste animal está indisponível. Procure o atendimento.</p> : null}
    <div className="anm-type-picker"><span className="anm-type-label">O que deseja solicitar?</span><div className="anm-type-cards">{context.requestTypes.filter((type) => type.active !== false).map((type) => <button type="button" key={type.id} className={`anm-type-card${selectedType === type.name ? " is-selected" : ""}`} onClick={() => onSelectType(type.name)}>{type.name}</button>)}</div></div>
  </div>;
}
