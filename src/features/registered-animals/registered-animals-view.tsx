import React from "react";
import { useRegisteredAnimals } from "./use-registered-animals";

export function RegisteredAnimalsView({ onSelect, onNew }: { onSelect: (id: string) => void; onNew: () => void }) {
  const state = useRegisteredAnimals();
  return <section className="registered-animals panel">
    <div className="tutor-auth-heading"><h2>Meus animais</h2><button type="button" className="primary-action" onClick={onNew}>Cadastrar outro animal</button></div>
    <label className="field"><span>Buscar por nome ou microchip</span><input type="search" maxLength={80} value={state.query} onChange={(event) => state.setQuery(event.target.value)} autoComplete="off" /></label>
    {state.loading && <p role="status">Carregando seus animais...</p>}
    {state.error && <div role="alert"><p className="form-error">{state.error}</p><button type="button" className="ghost-button" onClick={state.retry}>Tentar novamente</button></div>}
    {!state.loading && !state.error && state.animals.length + state.candidates.length === 0 && <p>{state.query ? "Nenhum dos seus animais corresponde à busca." : "Você ainda não tem animais disponíveis neste acesso. Faça a primeira solicitação para cadastrar um animal."}</p>}
    <div className="registered-animal-grid">
      {!state.loading && state.animals.map((animal) => <article className="registered-animal-card" key={animal.id}><h3>{animal.name || "Animal sem nome"}</h3><p>{[animal.species, animal.sex].filter(Boolean).join(" · ")}</p><p>{animal.confirmedMicrochip ? `Microchip confirmado: ${animal.confirmedMicrochip}` : animal.declaredMicrochip ? `Microchip informado: ${animal.declaredMicrochip}` : "Sem microchip"}</p><button type="button" className="primary-action" onClick={() => onSelect(animal.id)}>Nova solicitação</button></article>)}
      {!state.loading && state.candidates.map((candidate) => <article className="registered-animal-card" key={`${candidate.sourceRequestId}:${candidate.animalIndex}`}><h3>{candidate.name || "Animal sem nome"}</h3><p>{candidate.species}</p><p>Animal de uma solicitação anterior deste acesso.</p><button type="button" className="primary-action" disabled={Boolean(state.resolving)} onClick={async () => { const id = await state.resolve(candidate); if (id) onSelect(id); }}>{state.resolving === candidate.fingerprint ? "Preparando cadastro..." : "Usar este animal"}</button></article>)}
    </div>
    {state.nextCursor && <button type="button" className="ghost-button" onClick={state.loadMore} disabled={state.loading}>Carregar mais</button>}
  </section>;
}
