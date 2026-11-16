import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnimalTutorship } from "../../../shared/request-tutorship-contract.js";
import type { TutorStepData } from "../tutor-access/tutor-step-fields";
import { NoticeConsent } from "./notice-consent";
import { RequesterStep } from "./requester-step";
import type { RequesterStepProps } from "./requester-step";
import { TutorshipQuestion } from "./tutorship-question";

const noop = vi.fn();
const data: TutorStepData = { tutor: "", cpf: "", cep: "", number: "", state: "", address: "", neighborhood: "", city: "", latitude: "", longitude: "", email: "", phone: "" };
const props: RequesterStepProps = {
  tutorship: "", tutorshipFixed: false, tutorKnown: false, showErrors: false, onTutorshipChange: noop,
  tutorFields: { data, nameInvalid: false, nameIssue: "", cpfInvalid: false, neighborhoodNames: [], showErrors: false, onField: noop, onMaskedField: noop, onCepChange: noop },
  contacts: { email: "", phone: "" }, followUp: { enabled: false }, onFollowUpChange: noop,
  policy: { loading: false, error: "", phoneEnabled: true, retry: noop },
};
const html = (overrides: Partial<RequesterStepProps> = {}) => renderToStaticMarkup(<RequesterStep {...props} {...overrides} />);
const typed = { email: "tutor@example.com", phone: "(48) 99999-1234" };
const withContacts = (contacts = typed, overrides: Partial<RequesterStepProps> = {}): Partial<RequesterStepProps> => ({
  contacts, tutorFields: { ...props.tutorFields, data: { ...data, ...contacts } }, ...overrides,
});

describe("the question about the tutor", () => {
  it("starts with no answer, as a required question with both choices", () => {
    const markup = html();
    expect(markup).toContain("Esse animal tem tutor ou responsável?");
    expect(markup).toContain("Sim, tem tutor"); expect(markup).toContain("Não tem tutor");
    expect(markup).not.toContain('class="selected"');
    expect(markup).toContain("required-asterisk");
    for (const hidden of ["Responsável</span>", "Contato", "Quero receber avisos", 'type="checkbox"', "Quer acompanhar"]) expect(markup, hidden).not.toContain(hidden);
  });

  it("is marked invalid only when the person tried to go on without answering", () => {
    expect(html()).not.toContain("compact-choice-field invalid");
    expect(html({ showErrors: true })).toContain("compact-choice-field invalid");
    expect(html({ showErrors: true, tutorship: AnimalTutorship.WITH_TUTOR })).not.toContain("compact-choice-field invalid");
  });

  it("shrinks to one line once answered, with a way to change the answer", () => {
    const markup = renderToStaticMarkup(<TutorshipQuestion value={AnimalTutorship.WITHOUT_TUTOR} onChange={noop} />);
    expect(markup).toContain("Não tem tutor"); expect(markup).toContain("Alterar");
    expect(markup).not.toContain("compact-choice-field"); expect(markup).not.toContain("Sim, tem tutor");
  });

  it("is not asked of a tutor that is already known: the account or the registered animal answer it", () => {
    const markup = html({ tutorship: AnimalTutorship.WITH_TUTOR, tutorshipFixed: true });
    expect(markup).not.toContain("Esse animal tem tutor");
    expect(markup).toContain("Responsável");
  });
});

describe("with a tutor", () => {
  const markup = html({ tutorship: AnimalTutorship.WITH_TUTOR });

  it("opens the tutor's data and contact, and the acceptance of the notices right under them, never marked beforehand", () => {
    const order = ["Responsável", "Endereço", "Contato de cadastro", "Quero receber avisos"].map((text) => markup.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(markup).toContain('type="checkbox"'); expect(markup).not.toMatch(/type="checkbox"[^>]*checked=""/);
    expect(markup).toContain("Sem os avisos você não saberá se a data mudar. Guarde seu protocolo.");
  });

  it("locks the acceptance while there is no contact the notices can reach, and says how to fix it", () => {
    expect(markup).toMatch(/type="checkbox"[^>]*disabled=""/);
    expect(markup).toContain("Não há contato disponível");
    expect(html({ tutorship: AnimalTutorship.WITH_TUTOR, policy: { ...props.policy, phoneEnabled: false } })).toContain("ainda não envia avisos por celular");
  });

  it("names the channels it will use and unlocks when the tutor types them", () => {
    const both = html({ tutorship: AnimalTutorship.WITH_TUTOR, ...withContacts() });
    expect(both).toContain("por e-mail e celular"); expect(both).not.toMatch(/type="checkbox"[^>]*disabled=""/);
    expect(html({ tutorship: AnimalTutorship.WITH_TUTOR, ...withContacts({ email: "", phone: typed.phone }) })).toContain("por celular:");
    expect(html({ tutorship: AnimalTutorship.WITH_TUTOR, ...withContacts(typed, { policy: { ...props.policy, phoneEnabled: false } }) })).toContain("por e-mail:");
  });

  it("shows the acceptance as marked when it was given, and as unmarked when nothing can be reached", () => {
    expect(html({ tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: true }, ...withContacts() })).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html({ tutorship: AnimalTutorship.WITH_TUTOR, followUp: { enabled: true } })).not.toMatch(/type="checkbox"[^>]*checked=""/);
  });
});

describe("the acceptance of the notices", () => {
  const consent = (overrides: Partial<React.ComponentProps<typeof NoticeConsent>> = {}) => renderToStaticMarkup(
    <NoticeConsent checked={false} onChange={noop} reachable={{ email: "", phone: "" }} phoneEnabled loading={false} error="" onRetry={noop} {...overrides} />);

  it("waits for the channels to load and offers a retry when they fail, without locking the person out of the request", () => {
    expect(consent({ loading: true, reachable: { email: "a@b.co", phone: "" } })).toContain("Carregando os canais");
    expect(consent({ loading: true, reachable: { email: "a@b.co", phone: "" } })).toMatch(/type="checkbox"[^>]*disabled=""/);
    const failed = consent({ error: "Falha ao carregar", reachable: { email: "a@b.co", phone: "" } });
    expect(failed).toContain("Falha ao carregar"); expect(failed).toContain("Tentar novamente");
    expect(consent({ error: "Falha ao carregar" })).not.toContain("ainda não envia avisos");
  });
});

describe("without a tutor", () => {
  const markup = html({ tutorship: AnimalTutorship.WITHOUT_TUTOR });

  it("asks only whether the person wants the notices, with the answer 'no' standing until they say yes", () => {
    expect(markup).toContain("Quer acompanhar esta solicitação?");
    expect(markup).toContain("Sim, quero"); expect(markup).toContain("Não precisa");
    expect(markup.match(/class="selected"/g)).toHaveLength(1);
    expect(markup).toMatch(/class="selected"[^>]*title="Não precisa"/);
    for (const hidden of ["Responsável</span>", "Endereço", "Contato", 'type="email"', 'type="tel"', "CPF"]) expect(markup, hidden).not.toContain(hidden);
  });

  it("asks how to reach them after yes, and either contact is enough", () => {
    const yes = html({ tutorship: AnimalTutorship.WITHOUT_TUTOR, followUp: { enabled: true } });
    expect(yes).toContain("Contato para os avisos"); expect(yes).toContain('type="email"'); expect(yes).toContain('type="tel"');
    expect(yes).toMatch(/class="selected"[^>]*title="Sim, quero"/);
    expect(yes).not.toMatch(/aria-label="Celular para os avisos"[^>]*required/);
    expect(yes).not.toContain("Responsável</span>");
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

  it("sees only the contacts of the registration, masked, and the acceptance", () => {
    const markup = html({ ...known, ...withContacts() });
    expect(markup).toContain("Seus contatos");
    expect(markup).toContain("t*****@example.com"); expect(markup).toContain("(48) *****-1234");
    expect(markup).not.toContain("tutor@example.com"); expect(markup).not.toContain("99999-1234");
    expect(markup).toContain("por e-mail e celular"); expect(markup).toContain('type="checkbox"');
    for (const hidden of ["Esse animal tem tutor", "Responsável</span>", 'type="email"', 'type="tel"']) expect(markup, hidden).not.toContain(hidden);
  });

  it("is told when the registration has no contact that receives notices", () => {
    const markup = html(known);
    expect(markup).toContain("não tem um contato que receba avisos");
    expect(markup).toMatch(/type="checkbox"[^>]*disabled=""/);
  });
});
