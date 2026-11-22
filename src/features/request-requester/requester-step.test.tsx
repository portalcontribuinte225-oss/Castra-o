import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnimalTutorship } from "../../../shared/request-tutorship-contract.js";
import type { TutorStepData } from "../tutor-access/tutor-step-fields";
import { RequesterStep } from "./requester-step";
import type { RequesterStepProps } from "./requester-step";

const noop = vi.fn();
const data: TutorStepData = { tutor: "", cpf: "", cep: "", number: "", state: "", address: "", neighborhood: "", city: "", latitude: "", longitude: "", email: "", phone: "" };
const props: RequesterStepProps = {
  tutorship: "", tutorshipFixed: false, tutorKnown: false, showErrors: false, onTutorshipChange: noop,
  tutorFields: { data, identityRequired: false, nameInvalid: false, nameIssue: "", cpfInvalid: false, neighborhoodNames: [], showErrors: false, onField: noop, onMaskedField: noop, onCepChange: noop },
  contacts: { email: "", phone: "" }, followUp: { enabled: null }, onFollowUpChange: noop,
  policy: { loading: false, error: "", phoneEnabled: true, retry: noop },
};
const html = (overrides: Partial<RequesterStepProps> = {}) => renderToStaticMarkup(<RequesterStep {...props} {...overrides} />);
const typed = { email: "tutor@example.com", phone: "(48) 99999-1234" };
const withContacts = (contacts = typed, overrides: Partial<RequesterStepProps> = {}): Partial<RequesterStepProps> => ({
  contacts, tutorFields: { ...props.tutorFields, data: { ...data, ...contacts } }, ...overrides,
});
const entry = (first: boolean) => ({ entry: { first, onFirst: noop, onRegistered: noop } });
const yesDisabled = /<button[^>]*disabled=""[^>]*><strong[^>]*>Sim, quero/;
const chosen = /aria-pressed="true"/;

describe("how the person wants to request, on the public form", () => {
  it("is the only thing asked until a first request is chosen, with no card marked", () => {
    const markup = html(entry(false));
    expect(markup).toContain("Como deseja solicitar?");
    expect(markup).toContain("Primeira solicitação"); expect(markup).toContain("Animal já cadastrado");
    expect(markup.match(/<button[^>]*aria-pressed="false"/g)).toHaveLength(2);
    expect(markup).not.toMatch(chosen);
    expect(markup).not.toContain("Esse animal tem alguém");
    expect(markup).not.toContain("compact-choice-field");
  });

  it("is marked invalid only when the person tried to go on without choosing", () => {
    expect(html(entry(false))).not.toContain('aria-invalid="true"');
    expect(html({ ...entry(false), showErrors: true })).toContain('aria-label="Como deseja solicitar?" aria-invalid="true"');
  });

  it("shrinks to one line with Alterar once a first request is chosen, and the question about the tutor follows", () => {
    const markup = html(entry(true));
    expect(markup).toContain("Como deseja solicitar? <strong>Primeira solicitação</strong>"); expect(markup).toContain("Alterar");
    expect(markup).not.toContain("Animal já cadastrado");
    expect(markup.indexOf("Como deseja solicitar?")).toBeLessThan(markup.indexOf("Esse animal tem alguém que cuida dele?"));
  });

  it("is not asked at the counter", () => {
    expect(html()).not.toContain("Como deseja solicitar?");
    expect(html()).toContain("Esse animal tem alguém que cuida dele?");
  });
});

describe("the question about the tutor", () => {
  it("starts with no answer, in cards, and opens nothing else", () => {
    const markup = html();
    expect(markup).toContain("Sim, tem tutor"); expect(markup).toContain("Não tem tutor");
    expect(markup).not.toMatch(chosen);
    for (const hidden of ["Responsável</span>", "Contato", "Quer acompanhar", 'type="checkbox"']) expect(markup, hidden).not.toContain(hidden);
  });

  it("is marked invalid only when the person tried to go on without answering", () => {
    expect(html({ showErrors: true })).toContain('aria-label="Esse animal tem alguém que cuida dele?" aria-invalid="true"');
    expect(html({ showErrors: true, tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: false } })).not.toContain('aria-invalid="true"');
  });

  it("shrinks to one line once answered, with a way to change the answer", () => {
    const markup = html({ tutorship: AnimalTutorship.WITHOUT_TUTOR });
    expect(markup).toContain("Esse animal tem alguém que cuida dele? <strong>Não tem tutor</strong>"); expect(markup).toContain("Alterar");
    expect(markup).not.toContain("Sim, tem tutor");
  });

  it("is not asked of a tutor that is already known: the account or the registered animal answer it", () => {
    const markup = html({ tutorship: AnimalTutorship.WITH_TUTOR, tutorshipFixed: true });
    expect(markup).not.toContain("Esse animal tem alguém");
    expect(markup).toContain("Responsável");
  });
});

describe("with a tutor", () => {
  const markup = html({ tutorship: AnimalTutorship.WITH_TUTOR });

  it("opens the tutor's data and contact, and then asks about the notices with nothing marked", () => {
    const order = ["Responsável", "Endereço", "Contato de cadastro", "Quer acompanhar esta solicitação?"].map((text) => markup.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(markup).not.toMatch(chosen); expect(markup).not.toContain('type="checkbox"');
  });

  it("cannot say yes while there is no contact the notices can reach, and says how to fix it", () => {
    expect(markup).toMatch(yesDisabled);
    expect(markup).toContain("Não há contato disponível");
    expect(html({ tutorship: AnimalTutorship.WITH_TUTOR, policy: { ...props.policy, phoneEnabled: false } })).toContain("ainda não envia avisos por celular");
  });

  it("names the channels the notices will use once the tutor types them", () => {
    const both = html({ tutorship: AnimalTutorship.WITH_TUTOR, ...withContacts() });
    expect(both).toContain("Se aceitar, você fica por dentro de tudo por e-mail e celular: confirmação ou mudança do agendamento, análise dos documentos e o resultado da sua solicitação."); expect(both).not.toMatch(yesDisabled);
    expect(html({ tutorship: AnimalTutorship.WITH_TUTOR, ...withContacts({ email: "", phone: typed.phone }) })).toContain("por dentro de tudo por celular:");
    expect(html({ tutorship: AnimalTutorship.WITH_TUTOR, ...withContacts(typed, { policy: { ...props.policy, phoneEnabled: false } }) })).toContain("por dentro de tudo por e-mail:");
  });

  it("shrinks the answer to a line, and tells what is missing when a yes has no contact left", () => {
    const yes = { tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: true } };
    expect(html({ ...yes, ...withContacts() })).toContain("Quer acompanhar esta solicitação? <strong>Sim, quero</strong>");
    expect(html(yes)).not.toContain("ao menos um contato");
    expect(html({ ...yes, showErrors: true })).toContain("ao menos um contato");
  });

  it("is marked invalid when the person tried to go on without answering about the notices", () => {
    expect(html({ tutorship: AnimalTutorship.WITH_TUTOR, ...withContacts(), showErrors: true })).toContain('aria-label="Quer acompanhar esta solicitação?" aria-invalid="true"');
  });
});

describe("the channels of the notices", () => {
  it("wait to load and offer a retry when they fail, without a yes meanwhile", () => {
    const loading = html({ tutorship: AnimalTutorship.WITH_TUTOR, ...withContacts(), policy: { ...props.policy, loading: true } });
    expect(loading).toContain("Carregando os canais"); expect(loading).toMatch(yesDisabled);
    const failed = html({ tutorship: AnimalTutorship.WITH_TUTOR, ...withContacts(), policy: { ...props.policy, error: "Falha ao carregar" } });
    expect(failed).toContain("Falha ao carregar"); expect(failed).toContain("Tentar novamente"); expect(failed).toMatch(yesDisabled);
    expect(failed).not.toContain("ainda não envia avisos");
  });
});

describe("without a tutor", () => {
  const markup = html({ tutorship: AnimalTutorship.WITHOUT_TUTOR });

  it("asks only whether the person wants the notices, with nothing marked and yes available", () => {
    expect(markup).toContain("Quer acompanhar esta solicitação?");
    expect(markup).toContain("Sim, quero"); expect(markup).toContain("Não precisa");
    expect(markup).toContain("Se aceitar, você fica por dentro de tudo: confirmação ou mudança do agendamento");
    expect(markup).toContain("Se preferir não receber avisos, é só guardar o protocolo e consultar sua solicitação quando quiser.");
    expect(markup).not.toMatch(chosen); expect(markup).not.toMatch(yesDisabled);
    for (const hidden of ["Responsável</span>", "Endereço", "Contato", 'type="email"', 'type="tel"', "CPF"]) expect(markup, hidden).not.toContain(hidden);
  });

  it("asks how to reach them after yes, and either contact is enough", () => {
    const yes = html({ tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: true } });
    expect(yes).toContain("Quer acompanhar esta solicitação? <strong>Sim, quero</strong>");
    expect(yes).toContain("Contato para os avisos"); expect(yes).toContain('type="email"'); expect(yes).toContain('type="tel"');
    expect(yes).not.toContain("Responsável</span>");
  });

  it("asks nothing more after no", () => {
    const no = html({ tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: false } });
    expect(no).toContain("<strong>Não precisa</strong>"); expect(no).not.toContain("Contato para os avisos");
  });

  it("tells what is missing once the person tried to go on with a yes and no contact", () => {
    const yes = { tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: true } };
    expect(html(yes)).not.toContain("ao menos um contato");
    expect(html({ ...yes, showErrors: true })).toContain("ao menos um contato");
    expect(html({ ...yes, showErrors: true, ...withContacts({ email: "tutor@example.com", phone: "" }) })).not.toContain("ao menos um contato");
  });
});

describe("a tutor that is already known", () => {
  const known = { tutorship: AnimalTutorship.WITH_TUTOR, tutorshipFixed: true, tutorKnown: true };

  it("sees only the contacts of the registration, masked, and the question about the notices", () => {
    const markup = html({ ...known, ...withContacts() });
    expect(markup).toContain("Seus contatos");
    expect(markup).toContain("t*****@example.com"); expect(markup).toContain("(48) *****-1234");
    expect(markup).not.toContain("tutor@example.com"); expect(markup).not.toContain("99999-1234");
    expect(markup).toContain("por dentro de tudo por e-mail e celular:"); expect(markup).toContain("Quer acompanhar esta solicitação?");
    for (const hidden of ["Esse animal tem alguém", "Como deseja solicitar", "Responsável</span>", 'type="email"', 'type="tel"']) expect(markup, hidden).not.toContain(hidden);
  });

  it("cannot say yes when the registration has no contact that receives notices", () => {
    const markup = html(known);
    expect(markup).toContain("não tem um contato que receba avisos");
    expect(markup).toMatch(yesDisabled);
  });
});
