import test from "node:test";
import assert from "node:assert/strict";
import { DeliveryStatus, NotificationChannel, NotificationEvent } from "../../shared/notification-contract.js";
import { buildAccessPath, buildAccessUrl, readAccessLink } from "../../shared/request-access-contract.js";
import { buildEmailNotice } from "../src/services/notifications/email-notice-text.js";
import { buildNotificationMessage, registeredNoticeText } from "../src/services/notifications/notification-message.js";
import { loadAccessLink, notifyRequestRegistered } from "../src/services/notify-request-registered.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const URL = "https://castracao.example.com/?m=test-town&acessar=000123/2026";
const EVENT = NotificationEvent.REQUEST_REGISTERED;

function registeredRequest(overrides = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333", municipality_id: MUNICIPALITY, protocol: "000123/2026", status: "NOVA", cpf: "52998224725", tutor_id: null,
    schedule_date: "2026-11-20", schedule_location_name: "Unidade Municipal", history: [],
    workflow_data: { scheduleSlotTime: "09:00", followUp: { enabled: true, email: "tutor@example.test", phone: "" } }, ...overrides,
  };
}

test("the access link is the public address with the municipality and the protocol, and a bad one opens the page empty", () => {
  assert.equal(buildAccessPath({ slug: "test-town", protocol: "123/2026" }), "/?m=test-town&acessar=000123/2026");
  assert.equal(buildAccessUrl({ publicUrl: "https://castracao.example.com", slug: "test-town", protocol: "000123/2026" }), URL);
  assert.equal(buildAccessUrl({ publicUrl: "https://castracao.example.com/painel/", slug: "test-town", protocol: "000123/2026" }), URL, "only the origin is used");
  for (const publicUrl of ["", undefined, "castracao.example.com", "javascript:alert(1)", "ftp://castracao.example.com"]) {
    assert.equal(buildAccessUrl({ publicUrl, slug: "test-town", protocol: "000123/2026" }), "", String(publicUrl));
  }
  for (const slug of ["", "Test Town", "../x", "a".repeat(81), undefined]) assert.equal(buildAccessPath({ slug, protocol: "000123/2026" }), "", String(slug));
  assert.equal(buildAccessPath({ slug: "test-town", protocol: "abc" }), "");
  assert.deepEqual(readAccessLink("?m=test-town&acessar=000123/2026"), { slug: "test-town", protocol: "000123/2026" });
  assert.deepEqual(readAccessLink("?m=test-town&acessar=000123%2F2026"), { slug: "test-town", protocol: "000123/2026" });
  assert.deepEqual(readAccessLink("?m=Bad Slug&acessar=xyz"), { slug: "", protocol: "" });
  assert.equal(readAccessLink("?m=test-town"), null);
  assert.equal(readAccessLink(""), null);
  assert.equal(readAccessLink(undefined), null);
});

test("the notice gives the protocol, the visit, that it is under analysis and the link, by e-mail and WhatsApp alike", () => {
  const request = registeredRequest({ access_link: { url: URL, accountExists: false } });
  const text = `Solicitação registrada! Protocolo 000123/2026. Atendimento em 20/11/2026, às 09:00, em Unidade Municipal. Sua solicitação está em análise. Para ver seu requerimento e criar sua senha, acesse: ${URL}`;
  assert.equal(registeredNoticeText(request), text);
  assert.deepEqual(buildNotificationMessage(EVENT, request), { subject: "Solicitação registrada", message: text });
  assert.deepEqual(buildEmailNotice(EVENT, request), { subject: "Solicitação registrada", message: text });
  assert.equal(registeredNoticeText({ ...request, access_link: { url: URL, accountExists: true } }),
    `Solicitação registrada! Protocolo 000123/2026. Atendimento em 20/11/2026, às 09:00, em Unidade Municipal. Sua solicitação está em análise. Para ver seu requerimento, acesse: ${URL}`);
  assert.equal(registeredNoticeText(registeredRequest({ schedule_date: null, access_link: null })), "Solicitação registrada! Protocolo 000123/2026. Sua solicitação está em análise.");
  assert.equal(registeredNoticeText(registeredRequest({ schedule_location_name: "", workflow_data: {} })),
    "Solicitação registrada! Protocolo 000123/2026. Atendimento em 20/11/2026. Sua solicitação está em análise.");
  assert.doesNotMatch(registeredNoticeText(request), /52998224725|tutor@example/);
});

test("the link exists only for a request with a tutor and a public address, and says whether the password is still to be created", async () => {
  const calls = [];
  const database = (publicUrl, { profile = false } = {}) => ({ query: async (sql, values) => {
    calls.push(sql);
    if (sql.startsWith("SELECT value FROM config")) return { rows: publicUrl ? [{ value: { publicUrl } }] : [] };
    if (sql.startsWith("SELECT slug FROM municipalities")) return { rows: values[0] === MUNICIPALITY ? [{ slug: "test-town" }] : [] };
    if (sql.includes("FROM tutor_profiles p JOIN users u")) return { rows: profile ? [{}] : [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  } });
  assert.equal(await loadAccessLink(registeredRequest({ cpf: null }), database("https://castracao.example.com")), null);
  assert.equal(calls.length, 0, "a request without a tutor reads nothing");
  assert.equal(await loadAccessLink(registeredRequest(), database("")), null);
  assert.deepEqual(await loadAccessLink(registeredRequest(), database("https://castracao.example.com")), { url: URL, accountExists: false });
  assert.deepEqual(await loadAccessLink(registeredRequest(), database("https://castracao.example.com", { profile: true })), { url: URL, accountExists: true });
  assert.deepEqual(await loadAccessLink(registeredRequest({ tutor_id: "44444444-4444-4444-8444-444444444444" }), database("https://castracao.example.com")), { url: URL, accountExists: true });
});

test("the notice goes only with the notices accepted, carries the link and is kept in the history", async () => {
  const dispatched = [];
  const history = [];
  const appendHistory = async (entries, id, municipalityId) => { history.push({ entries, id, municipalityId }); };
  const dispatch = async (input) => { dispatched.push(input); return [{ event: input.event, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT }]; };
  for (const followUp of [undefined, { enabled: false, email: "", phone: "" }]) {
    assert.deepEqual(await notifyRequestRegistered(registeredRequest({ workflow_data: { followUp } }), { appendHistory, dispatch, accessLink: async () => ({ url: URL }) }), []);
  }
  assert.equal(dispatched.length + history.length, 0);
  const request = registeredRequest();
  const results = await notifyRequestRegistered(request, { appendHistory, dispatch, accessLink: async () => ({ url: URL, accountExists: false }) });
  assert.deepEqual(results, [{ event: EVENT, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT }]);
  assert.equal(dispatched[0].event, EVENT);
  assert.deepEqual(dispatched[0].request.access_link, { url: URL, accountExists: false });
  assert.equal(request.access_link, undefined, "the link is never saved with the request");
  assert.equal(history.length, 1);
  assert.deepEqual([history[0].id, history[0].municipalityId], [request.id, MUNICIPALITY]);
  assert.equal(history[0].entries[0].notes, "Solicitação registrada — E-mail: aceito para envio.");
});

test("without a link the notice still goes, and a channel that fails or a history that cannot be written never breaks the request", async () => {
  const dispatched = [];
  const history = [];
  const appendHistory = async (entries) => { history.push(...entries); };
  await notifyRequestRegistered(registeredRequest(), { appendHistory, accessLink: async () => { throw new Error("no address"); },
    dispatch: async (input) => { dispatched.push(input); return []; } });
  assert.equal(dispatched[0].request.access_link, null);
  assert.equal(history.length, 0, "no channel in use leaves no history");
  const failed = await notifyRequestRegistered(registeredRequest(), { appendHistory, accessLink: async () => null, dispatch: async () => { throw new Error("private provider body"); } });
  assert.deepEqual(failed, [{ event: EVENT, channel: NotificationChannel.EMAIL, status: DeliveryStatus.FAILED, reason: "Não foi possível preparar a notificação." }]);
  assert.equal(history.length, 1);
  assert.doesNotMatch(JSON.stringify(history), /private/);
  const unsaved = await notifyRequestRegistered(registeredRequest(), { appendHistory: async () => { throw new Error("down"); }, accessLink: async () => null,
    dispatch: async () => [{ event: EVENT, channel: NotificationChannel.EMAIL, status: DeliveryStatus.SENT }] });
  assert.equal(unsaved.at(-1).reason, "Operação salva; histórico do envio indisponível.");
});
