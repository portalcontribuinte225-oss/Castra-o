import test from "node:test";
import assert from "node:assert/strict";
import { SMS_MAX_LENGTH, SMS_PART_LENGTH, SMS_SINGLE_LENGTH, buildSmsTestText, buildSmsText, isSmsText, smsTextPreview, toSmsText } from "../../shared/sms-messages-contract.js";
import { smsUses } from "../../shared/sms-uses-contract.js";
import { AuthPurpose } from "../../shared/auth-contract.js";
import { NotificationEvent } from "../../shared/notification-contract.js";

const CODE_USES = [AuthPurpose.PASSWORD_RESET, AuthPurpose.VERIFY_PHONE, AuthPurpose.REQUEST_TRACKING];
const full = { municipality: "Criciúma", protocol: "123/2026", date: "20/11/2026", time: "09:00", location: "Unidade Veterinária Municipal", code: "123456", minutes: "10", fields: "e-mail", reason: "Documentação incompleta" };

test("the limits are the ones of SMS with accents: 70 characters in one, parts of 67, and three parts at most", () => {
  assert.deepEqual([SMS_SINGLE_LENGTH, SMS_PART_LENGTH, SMS_MAX_LENGTH], [70, 67, 201]);
});

test("accents stay, and anything outside letters, digits and the usual punctuation becomes a space", () => {
  assert.equal(toSmsText("Criciúma São José — ação"), "Criciúma São José ação");
  assert.equal(toSmsText("Unidade Veterinária Municipal"), "Unidade Veterinária Municipal");
  assert.equal(toSmsText("Criciúma"), "Criciúma", "a decomposed accent is put back together");
  assert.equal(toSmsText("a\nb\tc\u0000d"), "a b c d");
  assert.equal(toSmsText("preço €10 😀"), "preço 10");
  assert.equal(toSmsText("Rua 5, n. 10 (fundos): 100% #1 @casa!"), "Rua 5, n. 10 (fundos): 100% #1 @casa!");
  assert.equal(toSmsText(null), "");
  assert.equal(toSmsText(undefined), "");
  assert.equal(toSmsText(12345), "12345");
});

test("the sender accepts only a clean text within the longest length", () => {
  assert.equal(isSmsText("Içara: atendimento concluído!"), true);
  for (const text of ["", " espaço", "linha\nquebrada", "x".repeat(SMS_MAX_LENGTH + 1), "emoji 😀", null, 10]) assert.equal(isSmsText(text), false, String(text));
  assert.equal(isSmsText("x".repeat(SMS_MAX_LENGTH)), true);
});

test("every use has a fixed text within the longest length that starts with the municipality", () => {
  assert.equal(smsUses.length, 12);
  for (const { key } of smsUses) {
    const text = buildSmsText(key, full);
    assert.equal(isSmsText(text), true, key);
    assert.ok(text.startsWith("Criciúma: "), key);
  }
});

test("the texts are the agreed ones, in correct Portuguese", () => {
  assert.equal(buildSmsText(NotificationEvent.REQUEST_REGISTERED, full), "Criciúma: solicitação registrada! Protocolo: 123/2026. Aguardando aprovação!");
  assert.equal(buildSmsText(NotificationEvent.SCHEDULE_CONFIRMED, full), "Criciúma: agendamento confirmado! Esperamos você em 20/11/2026, às 09:00 na Unidade Veterinária Municipal. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.SCHEDULE_CHANGED, full), "Criciúma: seu atendimento foi reagendado para 20/11/2026, às 09:00 na Unidade Veterinária Municipal. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.SCHEDULE_CANCELLED, full), "Criciúma: o agendamento de 20/11/2026, às 09:00, foi cancelado. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.SCHEDULE_CANCELLED, { ...full, time: "" }), "Criciúma: o agendamento de 20/11/2026 foi cancelado. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.NO_SHOW, full), "Criciúma: você não compareceu ao atendimento de 20/11/2026. Fale com nossa equipe. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.COMPLETED, full), "Criciúma: atendimento concluído! Obrigado pelo cuidado com seu animal. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.REQUEST_REJECTED, full), "Criciúma: sua solicitação foi indeferida (Documentação incompleta). Fale com nossa equipe. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.REQUEST_REJECTED, { ...full, reason: "" }), "Criciúma: sua solicitação foi indeferida. Fale com nossa equipe. Protocolo: 123/2026.");
  assert.equal(buildSmsText(NotificationEvent.REQUEST_REJECTED, { ...full, procedure: "Castração" }), "Criciúma: o procedimento Castração foi indeferido (Documentação incompleta). Protocolo: 123/2026.");
  assert.equal(buildSmsText(AuthPurpose.PASSWORD_RESET, full), "Criciúma: recebemos um pedido para redefinir sua senha. Código: 123456. Válido por 10 minutos. Não compartilhe.");
  assert.equal(buildSmsText(AuthPurpose.VERIFY_PHONE, full), "Criciúma: para confirmar seu telefone, informe o código 123456. Válido por 10 minutos. Não compartilhe.");
  assert.equal(buildSmsText(AuthPurpose.REQUEST_TRACKING, full), "Criciúma: para consultar sua solicitação, use o código 123456. Válido por 10 minutos. Não compartilhe.");
  assert.equal(buildSmsText(AuthPurpose.CONTACT_CHANGED, full), "Criciúma: seus dados foram atualizados (e-mail). Se não foi você, fale com nossa equipe.");
});

test("the registered notice carries no visit and no link: the request still waits for analysis", () => {
  const text = buildSmsText(NotificationEvent.REQUEST_REGISTERED, { ...full, link: "https://c.test/a", scheduled: true });
  assert.equal(text, "Criciúma: solicitação registrada! Protocolo: 123/2026. Aguardando aprovação!");
  for (const { key } of smsUses) assert.equal(buildSmsText(key, { ...full, link: "https://c.test/a" }).includes("https://"), false, key);
});

test("the worst case still fits: long municipality, protocol, date, time and location are cut to make room", () => {
  const huge = { municipality: "Município de São José dos Campos do Norte ".repeat(5), protocol: "P".repeat(100), date: "D".repeat(100),
    time: "T".repeat(100), location: "Unidade Veterinária Municipal de Atendimento ".repeat(20), reason: "Documentação incompleta ".repeat(20), code: "123456", minutes: "1".repeat(50), fields: "e-mail".repeat(20) };
  for (const { key } of smsUses) {
    const text = buildSmsText(key, huge);
    assert.equal(isSmsText(text), true, `${key}: ${text.length}`);
    assert.ok(text.startsWith("Município de São José dos Camp: "), key);
  }
  const confirmed = buildSmsText(NotificationEvent.SCHEDULE_CONFIRMED, huge);
  assert.match(confirmed, / na Unidade/, "the place is shortened, not dropped, while there is room");
  assert.ok(confirmed.endsWith(`Protocolo: ${"P".repeat(20)}.`), "the protocol is never the part that is cut");
});

test("the code and its validity appear only in the messages that carry a code", () => {
  for (const { key } of smsUses) {
    const text = buildSmsText(key, full);
    assert.equal(text.includes("123456"), CODE_USES.includes(key), key);
    assert.equal(/Válido por 10 minutos/.test(text), CODE_USES.includes(key), key);
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
  for (const use of ["unknown", "initial_password", AuthPurpose.VERIFY_EMAIL, undefined]) assert.equal(buildSmsText(use, full), "", String(use));
  assert.equal(buildSmsText(NotificationEvent.COMPLETED), "Prefeitura: atendimento concluído! Obrigado pelo cuidado com seu animal. Protocolo: .");
});

test("the screen shows each message as it goes out, with the data in braces: filling them in gives exactly the text that is sent", () => {
  const filled = { "{protocolo}": "123/2026", "{data}": "20/11/2026", "{horario}": "09:00", "{unidade}": "Unidade Veterinária Municipal",
    "{codigo}": "123456", "{minutos}": "10", "{campos_alterados}": "e-mail", "{motivo}": "Documentação incompleta" };
  for (const { key } of smsUses) {
    const text = smsTextPreview(key, "Criciúma");
    assert.ok(text.startsWith("Criciúma: "), key);
    const sent = Object.entries(filled).reduce((result, [name, value]) => result.replaceAll(name, value), text);
    assert.equal(sent, buildSmsText(key, full), key);
    assert.ok(smsTextPreview(key).startsWith("Município: "), key);
  }
  assert.equal(smsTextPreview("unknown"), "");
});

test("the test message names the municipality, says it is a test and stays within the longest length", () => {
  assert.equal(buildSmsTestText("Criciúma"), "Criciúma: teste de envio de SMS do sistema de castração. Se você recebeu esta mensagem, o envio está funcionando.");
  for (const municipality of ["", "   ", undefined, null]) assert.ok(buildSmsTestText(municipality).startsWith("Prefeitura: "), String(municipality));
  const huge = buildSmsTestText("Município de São José dos Campos do Norte ".repeat(5));
  assert.equal(isSmsText(huge), true);
  assert.ok(huge.startsWith("Município de São José dos Camp: "));
});
