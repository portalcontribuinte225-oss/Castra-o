import test from "node:test";
import assert from "node:assert/strict";
import { emailUses } from "../../shared/email-uses-contract.js";
import { smsUses } from "../../shared/sms-uses-contract.js";
import { WHATSAPP_TEMPLATE_PREFIX, whatsappUses } from "../../shared/whatsapp-templates-contract.js";

const TITLES = [
  "Solicitação registrada", "Agendamento confirmado", "Lembrete de procedimento", "Agendamento alterado", "Não comparecimento",
  "Atendimento concluído", "Solicitação indeferida", "Recuperação de senha", "Confirmação de contato", "Acesso à solicitação", "Contato alterado",
];
const TEMPLATES = [
  "castracao_solicitacao_registrada", "castracao_agendamento_confirmado", "castracao_lembrete_agendamento_procedimento",
  "castracao_agendamento_alterado",
  "castracao_nao_comparecimento", "castracao_atendimento_concluido", "castracao_solicitacao_indeferida", "castracao_codigo_recuperacao_senha",
  "castracao_codigo_confirmacao_contato", "castracao_codigo_acesso_solicitacao", "castracao_contato_alterado",
];

test("SMS, e-mail and WhatsApp offer the same eleven messages, with the same titles in the same order", () => {
  for (const uses of [smsUses, emailUses, whatsappUses]) assert.deepEqual(uses.map(({ label }) => label), TITLES);
});

test("each WhatsApp message has its own template name, and none is about documents", () => {
  assert.deepEqual(whatsappUses.map(({ namePart }) => `${WHATSAPP_TEMPLATE_PREFIX}${namePart}`), TEMPLATES);
  for (const uses of [smsUses, emailUses, whatsappUses]) assert.equal(uses.some(({ key, label }) => /document/i.test(`${key} ${label}`)), false);
});
