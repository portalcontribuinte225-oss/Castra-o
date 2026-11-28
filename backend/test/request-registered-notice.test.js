import test from "node:test";
import assert from "node:assert/strict";
import { DeliveryStatus, NotificationChannel, NotificationEvent } from "../../shared/notification-contract.js";
import { buildAccessPath, buildAccessUrl, readAccessLink } from "../../shared/request-access-contract.js";
import { buildNotificationMessage } from "../src/services/notifications/notification-message.js";
import { loadAccessLink, notifyRequestRegistered } from "../src/services/notify-request-registered.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const URL = "https://castracao.example.com/?m=test-town&acessar";
const EVENT = NotificationEvent.REQUEST_REGISTERED;

function registeredRequest(overrides = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333", municipality_id: MUNICIPALITY, protocol: "000123/2026", status: "NOVA", cpf: "52998224725", tutor_id: null,
    schedule_date: "2026-11-20", schedule_location_name: "Unidade Municipal", history: [],
    workflow_data: { scheduleSlotTime: "09:00", followUp: { enabled: true, email: "tutor@example.test", phone: "" } }, ...overrides,
  };
}

test("the access link is the public address with the municipality, never the protocol, and an old or bad one still opens the page", () => {
  assert.equal(buildAccessPath({ slug: "test-town" }), "/?m=test-town&acessar");
  assert.equal(buildAccessUrl({ publicUrl: "https://castracao.example.com", slug: "test-town" }), URL);
  assert.equal(buildAccessUrl({ publicUrl: "https://castracao.example.com/painel/", slug: "test-town" }), URL, "only the origin is used");
  for (const publicUrl of ["", undefined, "castracao.example.com", "javascript:alert(1)", "ftp://castracao.example.com"]) {
    assert.equal(buildAccessUrl({ publicUrl, slug: "test-town" }), "", String(publicUrl));
  }
  for (const slug of ["", "Test Town", "../x", "a".repeat(81), undefined]) assert.equal(buildAccessPath({ slug }), "", String(slug));
  assert.deepEqual(readAccessLink("?m=test-town&acessar"), { slug: "test-town" });
  assert.deepEqual(readAccessLink("?m=test-town&acessar=000123/2026"), { slug: "test-town" }, "a link sent with the protocol still opens the page");
  assert.deepEqual(readAccessLink("?m=Bad Slug&acessar=xyz"), { slug: "" });
  assert.equal(readAccessLink("?m=test-town"), null);
  assert.equal(readAccessLink(""), null);
  assert.equal(readAccessLink(undefined), null);
});

test("the notice gives the protocol, the visit, that it is under analysis and the link, by e-mail and WhatsApp alike", () => {
  const request = registeredRequest({ access_link: { url: URL, accountExists: false } });
  const message = (input) => buildNotificationMessage(EVENT, input).message;
  const text = `Solicitação registrada. Protocolo: 000123/2026. Horário solicitado em 20/11/2026, às 09:00, em Unidade Municipal. Sua solicitação está em análise. Para ver seu requerimento e criar sua senha, acesse: ${URL}`;
  assert.deepEqual(buildNotificationMessage(EVENT, request), { subject: "Solicitação registrada", message: text });
  assert.match(message({ ...request, access_link: { url: URL, accountExists: true } }), /Para ver seu requerimento, acesse:/);
  assert.equal(message(registeredRequest({ schedule_date: null, access_link: null, schedule_location_name: "", workflow_data: {} })), "Solicitação registrada. Protocolo: 000123/2026. Sua solicitação está em análise.");
  assert.equal(message(registeredRequest({ schedule_location_name: "", workflow_data: {} })),
    "Solicitação registrada. Protocolo: 000123/2026. Horário solicitado em 20/11/2026. Sua solicitação está em análise.");
  assert.doesNotMatch(message(request), /52998224725|tutor@example|agendamento confirmado/i);
});

test("the link exists only for a request with a tutor and a public address, and says whether the password is still to be created", async () => {
  const calls = [];
  // The public address comes from the server's variables (APP_PUBLIC_URL).
  const env = (url) => ({ APP_PUBLIC_URL: url });
  const database = ({ profile = false } = {}) => ({ query: async (sql, values) => {
    calls.push(sql);
    if (sql.startsWith("SELECT slug FROM municipalities")) return { rows: values[0] === MUNICIPALITY ? [{ slug: "test-town" }] : [] };
    if (sql.includes("FROM tutor_profiles p JOIN users u")) return { rows: profile ? [{}] : [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  } });
  assert.equal(await loadAccessLink(registeredRequest({ cpf: null }), database(), env("https://castracao.example.com")), null);
  assert.equal(calls.length, 0, "a request without a tutor reads nothing");
  assert.equal(await loadAccessLink(registeredRequest(), database(), env("")), null);
  assert.equal(await loadAccessLink(registeredRequest(), database(), env("http://castracao.example.com")), null, "a published address is always https");
  assert.deepEqual(await loadAccessLink(registeredRequest(), database(), env("https://castracao.example.com")), { url: URL, accountExists: false });
  assert.deepEqual(await loadAccessLink(registeredRequest(), database({ profile: true }), env("https://castracao.example.com")), { url: URL, accountExists: true });
  assert.deepEqual(await loadAccessLink(registeredRequest({ tutor_id: "44444444-4444-4444-8444-444444444444" }), database(), env("https://castracao.example.com")), { url: URL, accountExists: true });
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
  assert.equal(history[0].entries[0].title, "Solicitação registrada");
  assert.equal(history[0].entries[0].notes, "E-mail: aceito para envio.");
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
