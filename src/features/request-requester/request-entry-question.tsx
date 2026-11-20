import { ChoiceQuestion } from "../../components/choice-question";

export const RequestEntry = Object.freeze({ FIRST: "first", REGISTERED: "registered" });

const options = [
  { value: RequestEntry.FIRST, label: "Primeira solicitação", description: "Vou informar os dados do animal e do responsável para fazer o primeiro pedido." },
  { value: RequestEntry.REGISTERED, label: "Animal já cadastrado", description: "Tenho acesso de tutor. Vou entrar para escolher um dos meus animais e fazer outro pedido." },
];

interface RequestEntryQuestionProps {
  // The person chose to make a first request here.
  first: boolean;
  onFirst: () => void;
  // A registered animal is asked for by its tutor, after signing in: the choice opens the sign-in and is not kept as an answer.
  onRegistered: () => void;
  invalid?: boolean;
}

// The first question of the public form: a first request goes on in this form, a registered animal goes through the tutor's sign-in.
export function RequestEntryQuestion({ first, onFirst, onRegistered, invalid = false }: RequestEntryQuestionProps) {
  return <ChoiceQuestion question="Como deseja solicitar?" options={options} value={first ? RequestEntry.FIRST : ""} invalid={invalid}
    onChange={(value) => (value === RequestEntry.REGISTERED ? onRegistered() : onFirst())} />;
}
