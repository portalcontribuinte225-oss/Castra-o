import test from "node:test";
import assert from "node:assert/strict";
import { SMS_MAX_LENGTH, buildSmsTestText, buildSmsText, smsTexts, toSmsText } from "../../shared/sms-messages-contract.js";
import { smsUses } from "../../shared/sms-uses-contract.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { DocumentsOutcome, NotificationEvent } from "../../shared/notification-contract.js";

const CODE_USES = [AuthPurpose.PASSWORD_RESET, AuthPurpose.VERIFY_PHONE, AuthPurpose.REQUEST_TRACKING];
const BASIC = /^[ -~]+$/;
const full = { municipality: "Criciúma", protocol: "123/2026", date: "20/11/2026", time: "09:00", location: "Unidade Veterinária Municipal", code: "123456", minutes: "10", fields: "e-mail", outcome: DocumentsOutcome.APPROVED, reason: "Documentação incompleta" };

test("accents are removed and anything outside the basic SMS alphabet becomes a space", () => {
  assert.equal(toSmsText("Criciúma São José — ação"), "Criciuma Sao Jose acao");
  assert.equal(toSmsText("Unidade Veterinária Municipal"), "Unidade Veterinaria Municipal");
  assert.equal(toSmsText("a\nb\tc\u0000d"), "a b c d");
  assert.equal(toSmsText("preço €10 😀"), "preco 10");
  assert.equal(toSmsText("Rua 5, n. 10 (fundos): 100% #1 @casa!"), "Rua 5, n. 10 (fundos): 100% #1 @casa!");
  assert.equal(toSmsText(null), "");
  assert.equal(toSmsText(undefined), "");
  assert.equal(toSmsText(12345), "12345");
});

test("every use has a fixed text in plain ASCII that fits one SMS and starts with the municipality", () => {
  assert.equal(smsUses.length, 10);
  for (const { key } of smsUses) {
    const text = buildSmsText(key, full);
    assert.match(text, BASIC, key);
    assert.ok(text.length > 0 && text.length <= SMS_MAX_LENGTH, `${key}: ${text.length}`);
    assert.ok(text.startsWith("Criciuma: "), key);
  }
  assert.equal(SMS_MAX_LENGTH, 160);
});

test("the texts are the agreed ones", () => {
  assert.equal(buildSmsText(AuthPurpose.PASSWORD_RESET, full), "Criciuma: recebemos um pedido para redefinir sua senha. Codigo: 123456. Valido por 10 minutos. Nao compartilhe.");
  assert.equal(buildSmsText(AuthPurpose.VERIFY_PHONE, full), "Criciuma: para confirmar seu telefone, informe o codigo 123456. Valido por 10 minutos. Nao compartilhe.");
  assert.equal(buildSmsText(AuthPurpose.REQUEST_TRACKING, full), "Criciuma: para consultar sua solicitacao, use o codigo 123456. Valido por 10 minutos. Nao compartilhe.");
  assert.equal(buildSmsText(NotificationEvent.SCHEDULE_CONFIRMED, full), "Criciuma: castracao confirmada! Esperamos voce em 20/11/2026, as 09:00 na Unidade Veterinaria Municipal. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.SCHEDULE_CHANGED, full), "Criciuma: seu atendimento foi reagendado para 20/11/2026, as 09:00 na Unidade Veterinaria Municipal. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.NO_SHOW, full), "Criciuma: voce nao compareceu ao agendamento de castracao de 20/11/2026. Fale com nossa equipe. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.COMPLETED, full), "Criciuma: atendimento de castracao concluido! Obrigado pelo cuidado com seu animal. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.REQUEST_REJECTED, full), "Criciuma: sua solicitacao foi indeferida (Documentacao incompleta). Fale com nossa equipe. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.REQUEST_REJECTED, { ...full, reason: "" }), "Criciuma: sua solicitacao foi indeferida. Fale com nossa equipe. Protocolo: 123/2026.");
  assert.equal(buildSmsText(AuthPurpose.CONTACT_CHANGED, full), "Criciuma: seus dados foram atualizados (e-mail). Se nao foi voce, fale com nossa equipe.");
});

test("the documents text follows the outcome: approved unless one document was rejected", () => {
  assert.equal(buildSmsText(NotificationEvent.DOCUMENTS_REVIEWED, full), "Criciuma: seus documentos foram aprovados e a solicitacao segue para as proximas etapas. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.DOCUMENTS_REVIEWED, { ...full, outcome: DocumentsOutcome.REJECTED }), "Criciuma: seus documentos nao foram aprovados. Acesse a solicitacao para ver o motivo. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.DOCUMENTS_REVIEWED, { ...full, outcome: "anything" }), buildSmsText(NotificationEvent.DOCUMENTS_REVIEWED, full));
});

test("the worst case still fits: long municipality, protocol, date, time and location are cut to make room", () => {
  const huge = { municipality: "Município de São José dos Campos do Norte ".repeat(5), protocol: "P".repeat(100), date: "D".repeat(100),
    time: "T".repeat(100), location: "Unidade Veterinária Municipal de Atendimento ".repeat(20), reason: "Documentação incompleta ".repeat(20), code: "123456", minutes: "1".repeat(50), fields: "e-mail".repeat(20) };
  for (const { key } of smsUses) {
    const text = buildSmsText(key, huge);
    assert.match(text, BASIC, key);
    assert.ok(text.length <= SMS_MAX_LENGTH, `${key}: ${text.length}`);
    assert.ok(text.startsWith("Municipio de Sao Jose dos Camp: "), key);
  }
  const confirmed = buildSmsText(NotificationEvent.SCHEDULE_CONFIRMED, huge);
  assert.match(confirmed, / na Unidade/, "the place is shortened, not dropped, while there is room");
  assert.ok(confirmed.endsWith(`Protocolo: ${"P".repeat(20)}.`), "the protocol is never the part that is cut");
});

test("the code and its validity appear only in the messages that carry a code", () => {
  for (const { key } of smsUses) {
    const text = buildSmsText(key, full);
    assert.equal(text.includes("123456"), CODE_USES.includes(key), key);
    assert.equal(/Valido por 10 minutos/.test(text), CODE_USES.includes(key), key);
  }
});

test("extra data never reaches a text, and a missing field never prints a placeholder word", () => {
  for (const { key } of smsUses) {
    const text = buildSmsText(key, { municipality: "Criciúma", code: "123456", minutes: "10", cpf: "52998224725", phone: "48999991234", email: "tutor@example.com", animal: "Rex" });
    assert.doesNotMatch(text, /undefined|null|\{|\}|52998224725|48999991234|tutor@|Rex/, key);
  }
});

test("without a municipality name the text still starts with a neutral one, and an unknown use has no text", () => {
  for (const municipality of ["", "   ", undefined, null, "🙂"]) {
    assert.ok(buildSmsText(AuthPurpose.PASSWORD_RESET, { ...full, municipality }).startsWith("Prefeitura: "), String(municipality));
  }
  for (const use of ["unknown", AuthPurpose.INITIAL_PASSWORD, AuthPurpose.VERIFY_EMAIL, undefined]) assert.equal(buildSmsText(use, full), "", String(use));
  assert.equal(buildSmsText(NotificationEvent.COMPLETED), "Prefeitura: atendimento de castracao concluido! Obrigado pelo cuidado com seu animal. Protocolo: .");
});

test("the screen shows each message as it goes out, with the data in braces: filling them in gives exactly the text that is sent", () => {
  const filled = { "{protocolo}": "123/2026", "{data}": "20/11/2026", "{horario}": "09:00", "{unidade}": "Unidade Veterinaria Municipal",
    "{codigo}": "123456", "{minutos}": "10", "{campos_alterados}": "e-mail", "{motivo}": "Documentacao incompleta" };
  for (const { key } of smsUses) {
    const shown = smsTexts(key, "Criciúma");
    assert.ok(shown.length > 0, key);
    for (const { outcome, text } of shown) {
      assert.ok(text.startsWith("Criciuma: "), key);
      const sent = Object.entries(filled).reduce((result, [name, value]) => result.replaceAll(name, value), text);
      assert.equal(sent, buildSmsText(key, { ...full, outcome: outcome ?? undefined }), key);
    }
    assert.ok(smsTexts(key).every(({ text }) => text.startsWith("Municipio: ")), key);
  }
  assert.deepEqual(smsTexts(AuthPurpose.PASSWORD_RESET, "Criciúma").map(({ outcome }) => outcome), [null]);
  assert.deepEqual(smsTexts(NotificationEvent.DOCUMENTS_REVIEWED).map(({ outcome }) => outcome), [DocumentsOutcome.APPROVED, DocumentsOutcome.REJECTED]);
  assert.deepEqual(smsTexts("unknown"), []);
});

test("the test message names the municipality, says it is a test and fits one SMS in plain ASCII", () => {
  assert.equal(buildSmsTestText("Criciúma"), "Criciuma: teste de envio de SMS do sistema de castracao. Se voce recebeu esta mensagem, o envio esta funcionando.");
  for (const municipality of ["", "   ", undefined, null]) assert.ok(buildSmsTestText(municipality).startsWith("Prefeitura: "), String(municipality));
  const huge = buildSmsTestText("Município de São José dos Campos do Norte ".repeat(5));
  assert.match(huge, BASIC); assert.ok(huge.length <= SMS_MAX_LENGTH);
  assert.ok(huge.startsWith("Municipio de Sao Jose dos Camp: "));
});
