import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Field } from "../../components/ui";
import { formatCep, onlyDigits } from "../../utils";
import { lookupCep } from "../animal-services/cep-lookup";
import { withCepAddress } from "./municipality-address";
import type { MunicipalityForm } from "./municipality-address";

interface MunicipalityAddressFieldsProps {
  form: MunicipalityForm;
  setForm: Dispatch<SetStateAction<MunicipalityForm>>;
  // Only the support sets the city and the state of a municipality; the others see them.
  canEditCity: boolean;
}

type CepStatus = "" | "loading" | "notFound";

// The address of a municipality in separate fields. The CEP comes first: once it has 8 digits the street, the neighborhood and, for
// the support, the city and the state are filled from it. A failed search never blocks typing the address by hand.
export function MunicipalityAddressFields({ form, setForm, canEditCity }: MunicipalityAddressFieldsProps) {
  const [status, setStatus] = useState<CepStatus>("");
  const latestCep = useRef("");
  const patch = (changes: Partial<MunicipalityForm>) => setForm((current) => ({ ...current, ...changes }));

  function changeCep(value: string) {
    const digits = onlyDigits(value).slice(0, 8);
    patch({ cep: formatCep(digits) });
    latestCep.current = digits.length === 8 ? digits : "";
    if (digits.length !== 8) { setStatus(""); return; }
    setStatus("loading");
    void lookupCep(digits).then((found) => {
      if (latestCep.current !== digits) return;
      if (!found) { setStatus("notFound"); return; }
      setStatus("");
      setForm((current) => withCepAddress(current, found, canEditCity));
    });
  }

  return (
    <>
      <div className="modal-form-grid">
        <Field label="CEP" value={form.cep} placeholder="00000-000" onChange={changeCep} />
        <Field label="Número" value={form.addressNumber} placeholder="Número" onChange={(value) => patch({ addressNumber: value })} />
      </div>
      {status === "loading" && <p className="helper-text" role="status">Buscando o CEP...</p>}
      {status === "notFound" && <p className="helper-text" role="status">CEP não encontrado. Preencha o endereço manualmente.</p>}
      <Field label="Rua" value={form.address} placeholder="Rua, avenida..." onChange={(value) => patch({ address: value })} />
      <div className="modal-form-grid">
        <Field label="Complemento" value={form.addressComplement} placeholder="Sala, bloco..." onChange={(value) => patch({ addressComplement: value })} />
        <Field label="Bairro" value={form.neighborhood} placeholder="Bairro" onChange={(value) => patch({ neighborhood: value })} />
      </div>
      {canEditCity ? (
        <div className="modal-form-grid">
          <Field label="Município" value={form.name} placeholder="Município" onChange={(value) => patch({ name: value })} />
          <Field label="UF" value={form.state} placeholder="UF" onChange={(value) => patch({ state: value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2) })} />
        </div>
      ) : (
        <p className="helper-text">{[form.name, form.state].filter(Boolean).join(" / ")}</p>
      )}
    </>
  );
}
