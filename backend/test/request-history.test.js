import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { pool } from "../src/db/index.js";
import router from "../src/routes/requests.js";
import { buildRequestHistory } from "../src/services/request-history.js";
import { RequestOrigin, RequestStatus } from "../../shared/request-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const REQUEST = "11111111-1111-4111-8111-111111111111";
const LOCAL = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const ACTOR = "44444444-4444-4444-8444-444444444444";
const at = (hour) => `2026-11-20T${hour}:00:00.000Z`;

test("the timeline orders process actions and tutor changes and dates closure from the transition", () => {
  const request = {
    created_at: at("10"), origin: RequestOrigin.INTERNAL, status: RequestStatus.COMPLETED,
    history: [
      { at: at("14"), status: RequestStatus.COMPLETED, by: "sistema", notes: "E-mail de conclusão", notification: { status: "sent" } },
      { at: at("13"), status: RequestStatus.COMPLETED, previousStatus: RequestStatus.SCHEDULED, by: ACTOR, notes: "Bidu: atendimento realizado." },
      { at: at("11"), status: RequestStatus.NEW, by: ACTOR, notes: "Documento deferido: identidade" },
    ],
    tutor_history: [{ at: at("12"), by: ACTOR, changes: { cpf: "identificador privado" } }],
  };
  const events = buildRequestHistory(request, new Map([[ACTOR, "Ana Silva"]]));
  assert.deepEqual(events.map(({ at, label, actor }) => [at, label, actor]), [
    [at("10"), "Solicitação registrada", "Atendimento interno"],
    [at("11"), "Documento deferido: identidade", "Ana Silva"],
    [at("12"), "Cadastro do tutor atualizado", "Ana Silva"],
    [at("13"), "Processo concluído", "Ana Silva"],
    [at("14"), "E-mail de conclusão", "Sistema"],
  ]);
  assert.equal(events[3].detail, "Bidu: atendimento realizado.");
  assert.doesNotMatch(JSON.stringify(events), /identificador privado|notification/);
});

test("legacy closure without an outcome record has no invented date", () => {
  const request = { created_at: at("10"), origin: RequestOrigin.PUBLIC, animal_origin: "death", status: RequestStatus.CANCELLED,
    history: [null, "Registro antigo", { at: at("13"), status: RequestStatus.CANCELLED, notes: "Evidência anexada" }] };
  const events = buildRequestHistory(request, new Map());
  assert.equal(events[0].actor, "Cadastro do animal");
  assert.equal(events[2].label, "Registro antigo");
  assert.deepEqual(events.at(-1), { kind: "end", at: null, label: "Processo cancelado", actor: null });
});

test("the history route requires staff and derives municipality scope from the authenticated user", async (t) => {
  const users = new Map();
  const calls = [];
  const originalQuery = pool.query;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "process-history-tests-only";
  pool.query = async (sql, values) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    calls.push(values);
    assert.match(sql, /a\.municipality_id = r\.municipality_id AND a\.action = \$3/);
    assert.match(sql, /r\.id = \$1 AND \(\$2::uuid IS NULL OR r\.municipality_id = \$2\)/);
    const [id, municipality, action] = values;
    assert.equal(action, "TUTOR_DATA_UPDATE");
    const visible = id === REQUEST && (municipality === LOCAL || municipality === null);
    return { rows: visible ? [{ municipality_id: LOCAL, created_at: at("10"), status: RequestStatus.NEW, origin: RequestOrigin.PUBLIC }] : [] };
  };
  const app = express();
  app.use("/requests", router);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = originalQuery;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  });
  function call(user, id = REQUEST) {
    const headers = user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {};
    return fetch(`http://127.0.0.1:${server.address().port}/requests/${id}/history?municipalityId=${LOCAL}`, { headers });
  }

  assert.equal((await call()).status, 401);
  for (const role of ["tutor", "ong", "protetor"]) assert.equal((await call({ role, municipalityId: LOCAL })).status, 403);
  assert.equal((await call({ role: "analista", municipalityId: LOCAL }, "invalid")).status, 404);
  assert.deepEqual(calls, []);
  assert.equal((await call({ role: "analista", municipalityId: OTHER })).status, 404);
  const local = await call({ role: "analista", municipalityId: LOCAL });
  assert.equal(local.status, 200);
  assert.equal(local.headers.get("Cache-Control"), "no-store");
  assert.equal((await local.json()).events[0].label, "Solicitação registrada");
  assert.equal((await call({ role: "suporte" })).status, 200);
  assert.deepEqual(calls.map(([, municipality]) => municipality), [OTHER, LOCAL, null]);
});
