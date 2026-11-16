import React from "react";
import { ScrollChecklist } from "../../components/scroll-checklist";
import type { AnyRecord } from "../../types";
import { requestTypeFeeLabel } from "./request-procedures";

interface RequestProcedureListProps {
  types: AnyRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
}

// The procedures of one animal: the municipality's request types, as a list with its own scroll, each one with its fee.
export function RequestProcedureList({ types, selectedIds, onChange, invalid = false }: RequestProcedureListProps) {
  const items = types.filter((type) => type.id).map((type) => ({ id: type.id, label: type.name, detail: requestTypeFeeLabel(type) }));
  return (
    <ScrollChecklist
      legend="Procedimentos"
      required
      groups={[{ id: "procedures", items }]}
      selectedIds={selectedIds}
      onChange={onChange}
      invalid={invalid}
      errorText="Escolha ao menos um procedimento"
      emptyText="Nenhum tipo de solicitação cadastrado. Cadastre em Configurar Ambiente > Tipos de solicitação."
    />
  );
}
