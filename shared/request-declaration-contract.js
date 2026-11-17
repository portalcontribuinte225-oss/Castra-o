// The declaration the tutor accepts when asking for a procedure, and the recommendations that go with it. The screen, the printed declaration
// and the request document (PDF) all read this one text. What depends on who is asking is a variable of the municipality ("{municipality}",
// "{department}"): it comes from the municipality of the request, never from what the tutor typed.
export const DeclarationVariable = Object.freeze({
  MUNICIPALITY: "municipality",
  DEPARTMENT: "department",
});

const token = (variable) => `{${variable}}`;
const MAX_NAME_LENGTH = 120;
const NAMELESS_MUNICIPALITY = "município";
const NAMELESS_DEPARTMENT = "a Prefeitura";

// `onlyWhenCharged`: the clause is about the fee, so it only applies to a request with a procedure that is charged.
const DECLARATION_ITEMS = Object.freeze([
  { text: "A total responsabilidade pela realização da captura e acondicionamento dos animais até a condução para o centro de castração onde serão realizados os procedimentos operatórios de castração." },
  { text: "Para fins de ordem legal, autorizo a prática dos procedimentos veterinário e declaro que estou ciente dos riscos inerentes a qualquer prática Anestésico-Cirúrgica Médico Veterinária, a ser procedida em meu animal." },
  { text: "A total responsabilidade pela realização dos cuidados pré e pós-operatório dos procedimentos de castração." },
  { text: `A total responsabilidade pela realização exames pré e pós-operatório dos procedimentos de castração que forem julgados como necessários pelos médicos veterinários do centro de castração, sem ônus para ${token(DeclarationVariable.DEPARTMENT)}.` },
  { text: `Que não utilizarei os encaminhamentos para procedimentos cirúrgicos para favorecer animais de terceiros ou não pertencentes ao ${token(DeclarationVariable.MUNICIPALITY)}, assim como não cobrarei pelos serviços de encaminhamento.` },
  { text: "Que tenho como residência fixa o endereço acima informado." },
  { text: "As informações descritas na solicitação serão conferidas com o animal no dia da cirurgia, caso essas informações não descrevam o animal, ele não passará pelo procedimento cirúrgico." },
  { text: "Da solicitação cirúrgica para animais de raça de agricultores será realizado o procedimento após pagamento da taxa.", onlyWhenCharged: true },
  { text: "Declaro que todas as informações prestadas e documentos anexos são verdadeiros e assumo a responsabilidade pelos mesmos sob as penas da lei e afirmo ter conhecimento da legislação pertinente ao objetivo deste requerimento." },
  { text: "Declaro ainda, a inteira responsabilidade pelas informações contidas nessa declaração, estando ciente de que a omissão ou a apresentação de informações e/ou documentos falsos ou divergentes implicam na infração do art. 299 do Código Penal, além das medidas judiciais cabíveis." },
]);

const RECOMMENDATION_ITEMS = Object.freeze([
  "Jejum hídrico e alimentar de 8 horas;",
  "Felinos levar em caixa de transporte;",
  "Levar roupinha cirúrgica se tiver ou colar Elizabetano.",
]);

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);

// The words that take the place of each variable. Without the name of the municipality it is "o município"; without a department,
// "a Prefeitura" (the article goes with the word, as it is used in the sentence).
export function declarationVariables({ municipalityName, departmentName } = {}) {
  const municipality = clean(municipalityName);
  const department = clean(departmentName);
  return {
    [DeclarationVariable.MUNICIPALITY]: municipality ? `${NAMELESS_MUNICIPALITY} de ${municipality}` : NAMELESS_MUNICIPALITY,
    [DeclarationVariable.DEPARTMENT]: department ? `a ${department}` : NAMELESS_DEPARTMENT,
  };
}

// The declaration of one request, for its municipality: the text of each clause that applies, with the variables filled in.
export function renderDeclaration({ municipalityName = "", departmentName = "", charged = false } = {}) {
  const values = declarationVariables({ municipalityName, departmentName });
  // One pass over the text: what a name contains is never read as another variable.
  const fill = (text) => text.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(values, name) ? values[name] : match));
  return {
    items: DECLARATION_ITEMS.filter((item) => !item.onlyWhenCharged || charged).map((item) => fill(item.text)),
    recommendations: [...RECOMMENDATION_ITEMS],
  };
}
