import { useState } from "react";
import { AnimalTutorship } from "../../../shared/request-tutorship-contract.js";
import { CompactChoiceField } from "../../components/ui";

const QUESTION = "Esse animal tem tutor ou responsável?";

const answers = [
  { value: AnimalTutorship.WITH_TUTOR, label: "Sim, tem tutor", subtitle: "Eu ou outra pessoa cuida dele." },
  { value: AnimalTutorship.WITHOUT_TUTOR, label: "Não tem tutor", subtitle: "Animal de rua ou da comunidade." },
];

// The first thing asked about a request. It starts with no answer; once answered it shrinks to one line ("Alterar" brings the choice
// back) and what depends on the answer opens below it.
export function TutorshipQuestion({ value, onChange, invalid = false }: { value: string; onChange: (value: string) => void; invalid?: boolean }) {
  const [changing, setChanging] = useState(false);
  const answer = answers.find((item) => item.value === value);
  if (answer && !changing) {
    return (
      <div className="form-sub-card requester-answer">
        <span>{QUESTION} <strong>{answer.label}</strong></span>
        <button className="inline-link-button" type="button" onClick={() => setChanging(true)}>Alterar</button>
      </div>
    );
  }
  return (
    <div className="form-sub-card">
      <CompactChoiceField label={QUESTION} required value={value} options={answers} invalid={invalid} onChange={(next: string) => { setChanging(false); onChange(next); }} />
    </div>
  );
}
