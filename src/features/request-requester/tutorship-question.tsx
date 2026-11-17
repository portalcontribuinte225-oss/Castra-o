import { AnimalTutorship } from "../../../shared/request-tutorship-contract.js";
import { ChoiceQuestion } from "../../components/ui";

const options = [
  { value: AnimalTutorship.WITH_TUTOR, label: "Sim, tem tutor", description: "Eu ou outra pessoa cuida dele." },
  { value: AnimalTutorship.WITHOUT_TUTOR, label: "Não tem tutor", description: "Animal de rua ou da comunidade." },
];

// Whether the animal has a tutor: it decides whether the tutor's data are asked. It starts with no answer.
export function TutorshipQuestion({ value, onChange, invalid = false }: { value: string; onChange: (value: string) => void; invalid?: boolean }) {
  return <ChoiceQuestion question="Esse animal tem tutor ou responsável?" options={options} value={value} invalid={invalid} onChange={onChange} />;
}
