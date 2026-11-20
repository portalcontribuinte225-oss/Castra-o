import { AnimalTutorship } from "../../../shared/request-tutorship-contract.js";
import { ChoiceQuestion } from "../../components/choice-question";

const options = [
  { value: AnimalTutorship.WITH_TUTOR, label: "Sim, tem tutor", description: "Eu ou outra pessoa cuida dele e se responsabiliza por ele." },
  { value: AnimalTutorship.WITHOUT_TUTOR, label: "Não tem tutor", description: "É um animal de rua ou da comunidade, sem um responsável fixo." },
];

// Whether the animal has a tutor: it decides whether the tutor's data are asked. It starts with no answer.
export function TutorshipQuestion({ value, onChange, invalid = false }: { value: string; onChange: (value: string) => void; invalid?: boolean }) {
  return <ChoiceQuestion question="Esse animal tem alguém que cuida dele?" options={options} value={value} invalid={invalid} onChange={onChange} />;
}
