import React, { useState } from "react";
import { WhatsappMappingKind, WhatsappTemplateField, whatsappFieldLabels } from "../../../shared/whatsapp-binding-contract.js";
import { bindableTemplates, renderTemplatePreview, templateKey } from "./whatsapp-template-display";
import type { EventBinding, MappingItem, TemplateCatalog } from "./whatsapp-integration-types";

interface Props {
  eventLabel: string;
  current: EventBinding | null;
  catalog: TemplateCatalog;
  saving: boolean;
  onSave: (binding: EventBinding) => Promise<string>;
  onCancel: () => void;
}

const fieldOptions = Object.values(WhatsappTemplateField) as string[];
const emptyItem = (): MappingItem => ({ kind: WhatsappMappingKind.FIELD, value: "" });

export function WhatsappBindingEditor({ eventLabel, current, catalog, saving, onSave, onCancel }: Props) {
  const options = bindableTemplates(catalog);
  const currentKey = current ? templateKey({ name: current.templateName, language: current.languageCode }) : "";
  const [selected, setSelected] = useState(() => (options.some((template) => templateKey(template) === currentKey) ? currentKey : ""));
  const template = options.find((option) => templateKey(option) === selected) || null;
  const [mapping, setMapping] = useState<MappingItem[]>(() => (selected && current ? current.mapping : []));
  const [error, setError] = useState("");

  function choose(key: string) {
    const next = options.find((option) => templateKey(option) === key) || null;
    setSelected(key);
    setError("");
    setMapping(Array.from({ length: next?.variableCount ?? 0 }, (_unused, index) => (key === currentKey && current?.mapping[index]) || emptyItem()));
  }

  function update(index: number, item: MappingItem) {
    setMapping((items) => items.map((existing, position) => (position === index ? item : existing)));
  }

  const complete = Boolean(template) && mapping.length === template.variableCount && mapping.every((item) => item.value.trim() !== "");

  async function submit() {
    if (!template || !complete) return;
    const message = await onSave({
      templateName: template.name,
      languageCode: template.language,
      mapping: mapping.map((item) => ({ kind: item.kind, value: item.kind === WhatsappMappingKind.TEXT ? item.value.trim() : item.value })),
    });
    if (message) setError(message);
  }

  return (
    <section className="whatsapp-binding-editor" aria-label={`Vínculo: ${eventLabel}`}>
      <h4>Vínculo: {eventLabel}</h4>
      {!options.length && <p role="status">Nenhum template aprovado e compatível. Sincronize os templates com a Meta e tente novamente.</p>}
      <label className="field">
        <span>Template</span>
        <select value={selected} onChange={(event) => choose(event.target.value)} disabled={saving || !options.length}>
          <option value="">Escolha um template aprovado</option>
          {options.map((option) => <option key={templateKey(option)} value={templateKey(option)}>{option.name} ({option.language}) — {option.variableCount} variável(is)</option>)}
        </select>
      </label>
      {template && <>
        <p className="whatsapp-preview"><strong>Texto do template:</strong> {template.bodyText}</p>
        {mapping.map((item, index) => (
          <div className="whatsapp-mapping-row" key={index}>
            <code>{`{{${index + 1}}}`}</code>
            <select aria-label={`Tipo da variável ${index + 1}`} value={item.kind} disabled={saving} onChange={(event) => update(index, { kind: event.target.value as MappingItem["kind"], value: "" })}>
              <option value={WhatsappMappingKind.FIELD}>Campo do sistema</option>
              <option value={WhatsappMappingKind.TEXT}>Texto fixo</option>
            </select>
            {item.kind === WhatsappMappingKind.FIELD ? (
              <select aria-label={`Campo da variável ${index + 1}`} value={item.value} disabled={saving} onChange={(event) => update(index, { kind: item.kind, value: event.target.value })}>
                <option value="">Escolha o campo</option>
                {fieldOptions.map((field) => <option key={field} value={field}>{(whatsappFieldLabels as Record<string, string>)[field]}</option>)}
              </select>
            ) : (
              <input aria-label={`Texto fixo da variável ${index + 1}`} maxLength={200} value={item.value} disabled={saving} onChange={(event) => update(index, { kind: item.kind, value: event.target.value })} />
            )}
          </div>
        ))}
        <p className="whatsapp-preview"><strong>Prévia com dados de exemplo:</strong> {renderTemplatePreview(template.bodyText, mapping)}</p>
      </>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="whatsapp-save-row">
        <button type="button" className="primary-action" disabled={saving || !complete} onClick={submit}>{saving ? "Salvando..." : "Salvar vínculo"}</button>
        <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>Cancelar</button>
      </div>
    </section>
  );
}
