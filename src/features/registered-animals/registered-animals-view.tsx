import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Input } from "../../components/input";
import { useRegisteredAnimals } from "./use-registered-animals";
import { AnimalService } from "../animal-services/animal-service-types";
import type { AnimalSummary } from "../animal-services/animal-service-types";

const animalCardStyle = "tw:grid tw:min-w-0 tw:gap-3 tw:p-5";

export function RegisteredAnimalsView({ onSelect, onNew, onService }: { onSelect: (id: string) => void; onNew: () => void; onService: (animal: AnimalSummary, service: AnimalService) => void }) {
  const state = useRegisteredAnimals();
  return <Card as="section" className="tw:grid tw:gap-4 tw:p-5">
    <div className="tutor-auth-heading"><h2>Meus animais</h2><Button onClick={onNew}>Cadastrar outro animal</Button></div>
    <label className="tw:grid tw:gap-1.5">
      <span className="tw:text-sm tw:text-ui-muted">Buscar por nome ou microchip</span>
      <Input type="search" maxLength={80} value={state.query} onChange={(event) => state.setQuery(event.target.value)} autoComplete="off" />
    </label>
    {state.loading && <p role="status">Carregando seus animais...</p>}
    {state.error && <div><p className="form-error" role="alert">{state.error}</p><Button variant="outline" onClick={state.retry}>Tentar novamente</Button></div>}
    {!state.loading && !state.error && state.animals.length + state.candidates.length === 0 && <p>{state.query ? "Nenhum dos seus animais corresponde à busca." : "Você ainda não tem animais disponíveis neste acesso. Faça a primeira solicitação para cadastrar um animal."}</p>}
    {!state.loading && state.animals.length + state.candidates.length > 0 && <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] tw:gap-4">
      {state.animals.map((animal) => (
        <Card as="article" className={animalCardStyle} key={animal.id}>
          <h3 className="tw:m-0">{animal.name || "Animal sem nome"}</h3>
          <p className="tw:m-0">{[animal.species, animal.sex].filter(Boolean).join(" · ")}</p>
          <p className="tw:m-0">{animal.confirmedMicrochip ? `Microchip confirmado: ${animal.confirmedMicrochip}` : animal.declaredMicrochip ? `Microchip informado: ${animal.declaredMicrochip}` : "Sem microchip"}</p>
          <Button onClick={() => onSelect(animal.id)}>Nova solicitação</Button>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button variant="outline" onClick={() => onService(animal, AnimalService.RECORD)}>Prontuário</Button>
            <Button variant="outline" onClick={() => onService(animal, AnimalService.TRANSFER)}>Trocar tutor</Button>
            <Button variant="danger" onClick={() => onService(animal, AnimalService.DEATH)}>Registrar óbito</Button>
          </div>
        </Card>
      ))}
      {state.candidates.map((candidate) => (
        <Card as="article" className={animalCardStyle} key={`${candidate.sourceRequestId}:${candidate.animalIndex}`}>
          <h3 className="tw:m-0">{candidate.name || "Animal sem nome"}</h3>
          <p className="tw:m-0">{candidate.species}</p>
          <p className="tw:m-0">Animal de uma solicitação anterior deste acesso.</p>
          <Button disabled={Boolean(state.resolving)} onClick={async () => {
            const id = await state.resolve(candidate);
            if (id) onSelect(id);
          }}>{state.resolving === candidate.fingerprint ? "Preparando cadastro..." : "Usar este animal"}</Button>
        </Card>
      ))}
    </div>}
    {state.nextCursor && <Button variant="outline" className="tw:justify-self-start" onClick={state.loadMore} disabled={state.loading}>Carregar mais</Button>}
  </Card>;
}
