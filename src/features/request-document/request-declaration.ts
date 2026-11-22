// The declaration the tutor accepts on the web and signs at the counter. The form shows it and the requirement prints it, from this text.
const MUNICIPALITY_TOKEN = "{municipality}";
const MAX_NAME_LENGTH = 120;

interface DeclarationGroup {
  title: string;
  items: string[];
}

const DECLARATION_GROUPS: readonly DeclarationGroup[] = [
  {
    title: "CUIDADOS E AUTORIZAÇÃO",
    items: [
      "Assumo a responsabilidade pela captura, pelo acondicionamento e pelo transporte dos animais até o local de atendimento.",
      "Autorizo os procedimentos veterinários indicados e declaro ciência dos riscos inerentes aos atos anestésico-cirúrgicos, quando aplicáveis.",
      "Responsabilizo-me pelos cuidados pré e pós-operatórios dos procedimentos realizados.",
      "Responsabilizo-me pelos exames pré e pós-operatórios que os médicos-veterinários julgarem necessários, sem ônus para a Prefeitura.",
    ],
  },
  {
    title: "ELEGIBILIDADE E VERACIDADE DAS INFORMAÇÕES",
    items: [
      `Não utilizarei encaminhamentos para beneficiar animais de terceiros ou não residentes no ${MUNICIPALITY_TOKEN}, nem cobrarei pelos serviços de encaminhamento.`,
      "Declaro possuir residência fixa no endereço informado neste requerimento.",
      "Estou ciente de que os dados informados serão conferidos com o animal no atendimento e que divergências poderão impedir a realização do procedimento.",
      "Declaro que as informações prestadas e os documentos apresentados são verdadeiros, assumindo as responsabilidades legais correspondentes.",
      "Estou ciente de que omissões ou informações e documentos falsos ou divergentes podem ensejar responsabilização, inclusive nos termos do art. 299 do Código Penal.",
    ],
  },
];

const DECLARATION_RECOMMENDATIONS = [
  "Transporte felino em caixa apropriada; quando indicado, levar roupa cirúrgica ou colar elizabetano. Jejum e demais cuidados devem seguir a orientação individual fornecida pelo(a) médico(a)-veterinário(a).",
];

export const DECLARATION_TITLE = "DECLARAÇÃO DE CIÊNCIA E RESPONSABILIDADES";
export const RECOMMENDATIONS_TITLE = "ORIENTAÇÕES PARA O DIA DO ATENDIMENTO";

// The declaration for the municipality of the request: a fresh copy each time, naming it once and literally.
export function renderDeclaration({ municipalityName = "" }: { municipalityName?: string } = {}) {
  const name = String(municipalityName ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  const municipality = name ? `município de ${name}` : "município";
  return {
    groups: DECLARATION_GROUPS.map(({ title, items }) => ({ title, items: items.map((item) => item.replace(MUNICIPALITY_TOKEN, () => municipality)) })),
    recommendations: [...DECLARATION_RECOMMENDATIONS],
  };
}

export function declarationIntro(tutor = ""): string {
  const name = tutor.trim();
  return `Eu${name ? `, ${name},` : ","} na condição de tutor(a) ou responsável pelos animais identificados neste requerimento, declaro, para os devidos fins, que:`;
}
