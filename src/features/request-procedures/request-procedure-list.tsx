import React from "react";
import { MultiSelectDropdown } from "../../components/multi-select-dropdown";
import type { AnyRecord } from "../../types";
import { requestTypeFeeLabel } from "./request-procedures";

interface RequestProcedureListProps {
  types: AnyRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
}

// The procedures of one animal: the municipality's request types, in a field that opens a list, each one with its fee.
export function RequestProcedureList({ types, selectedIds, onChange, invalid = false }: RequestProcedureListProps) {
  const items = types.filter((type) => type.id).map((type) => ({ id: type.id, label: type.name, detail: requestTypeFeeLabel(type) }));
  return (
    <>
      <div className="form-sub-card-heading">
        <span className="form-sub-card-title">Qual procedimento solicitar?<span className="required-asterisk">*</span></span>
        <small className="form-hint">Pode marcar mais de um.</small>
      </div>
      <MultiSelectDropdown
        label="Procedimentos"
        placeholder="Selecione os procedimentos"
        items={items}
        selectedIds={selectedIds}
        onChange={onChange}
        invalid={invalid}
        errorText="Escolha ao menos um procedimento"
        emptyText="Nenhum tipo de solicitação cadastrado. Cadastre em Configurar Ambiente > Tipos de solicitação."
      />
    </>
  );
}
