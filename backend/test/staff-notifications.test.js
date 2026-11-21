import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import router from "../src/routes/notifications.js";
import { pool } from "../src/db/index.js";
import { REQUEST_CONTACT_CPF_KEY } from "../../shared/request-contract.js";
import { StaffNotificationType } from "../../shared/staff-notifications-contract.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

const LOCAL = "11111111-1111-4111-8111-111111111111";
const REMOTE = "22222222-2222-4222-8222-222222222222";
const STAFF = { id: "33333333-3333-4333-8333-333333333333", role: "analista", municipalityId: LOCAL };
const COLLEAGUE = { ...STAFF, id: "44444444-4444-4444-8444-444444444444" };
const DENIED = { ...STAFF, id: "55555555-5555-4555-8555-555555555555" };
const GLOBAL = { id: "66666666-6666-4666-8666-666666666666", role: "suporte" };
const REQUEST_ID = "77777777-7777-4777-8777-777777777777";
const { REQUEST_CREATED, REQUEST_ASSIGNED } = StaffNotificationType;

function event(id, municipality_id, recipient_user_id = null, overrides = {}) {
  return { id: String(id), municipality_id, request_id: REQUEST_ID, recipient_user_id,
    event_type: recipient_user_id ? REQUEST_ASSIGNED : REQUEST_CREATED, created_at: "2026-11-20T00:00:00.000Z",
    protocol: "000042/2026", tutor_name: "Citizen", ...overrides };
}

async function fixture(t, events = [event(1, LOCAL), event(2, REMOTE), event(3, LOCAL, STAFF.id), event(4, LOCAL, COLLEAGUE.id)]) {
  const previous = { query: pool.query, connect: pool.connect, secret: process.env.JWT_SECRET };
  process.env.JWT_SECRET = "staff-notification-tests-only";
  const users = new Map();
  const reads = new Set();
  const calls = [];
  const query = async (sql, parameters = []) => {
    const session = resolveTestSession(sql, parameters, users);
    if (session) return session;
    calls.push(sql);
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("SELECT value FROM config")) {
      assert.equal(parameters[1], LOCAL);
      const value = parameters[0] === "permission_groups"
        ? [{ id: "only-dashboard", allowedMenuItems: ["dashboard"], active: true }]
        : { users: [{ id: DENIED.id, permissionGroupId: "only-dashboard" }] };
      return { rows: [{ value }] };
    }
    assert.match(sql, /JOIN requests r ON r\.id = e\.request_id AND r\.municipality_id = e\.municipality_id/);
    assert.match(sql, /JOIN municipalities m ON m\.id = e\.municipality_id AND m\.active = TRUE/);
    assert.match(sql, /e\.municipality_id = \$2/);
    assert.match(sql, /e\.recipient_user_id = \$1/);
    const [userId, municipality, idOrCursor, limit] = parameters;
    const visible = events.filter((entry) => !entry.unavailable && (!municipality || entry.municipality_id === municipality)
      && (!entry.recipient_user_id || entry.recipient_user_id === userId));
    const readKey = (entry) => `${entry.id}:${userId}`;
    if (sql.includes("INSERT INTO staff_notification_reads")) {
      assert.match(sql, /FOR KEY SHARE OF e, r/);
      assert.match(sql, /SELECT notification_id, \$1 FROM target ON CONFLICT DO NOTHING/);
      const selected = visible.find((entry) => entry.id === idOrCursor);
      if (!selected) return { rows: [] };
      reads.add(readKey(selected));
      return { rows: [{ request: { id: selected.request_id, protocol: selected.protocol, municipality_id: selected.municipality_id,
        tutor_name: selected.tutor_name, is_confidential: true, workflow_data: { [REQUEST_CONTACT_CPF_KEY]: "123", public: "value" } } }] };
    }
    assert.match(sql, /s\.user_id = \$1/);
    if (sql.includes("COUNT(*)")) return { rows: [{ count: String(visible.filter((entry) => !reads.has(readKey(entry))).length) }] };
    return { rows: visible.filter((entry) => !idOrCursor || Number(entry.id) < Number(idOrCursor))
      .sort((a, b) => Number(b.id) - Number(a.id)).slice(0, limit).map((entry) => ({ ...entry, read: reads.has(readKey(entry)) })) };
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const app = express();
  app.use("/notifications", router);
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    pool.query = previous.query; pool.connect = previous.connect;
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
  });
  async function call(path = "", { user, method = "GET" } = {}) {
    const headers = user ? { Authorization: `Bearer ${registerTestSession(users, user)}` } : {};
    const response = await fetch(`http://127.0.0.1:${server.address().port}/notifications${path}`, { method, headers });
    return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
  }
  return { call, reads, calls };
}

test("notifications require an authenticated internal user with the Requests menu", async (t) => {
  const { call, calls } = await fixture(t);
  assert.equal((await call()).status, 401);
  for (const role of ["tutor", "ong", "protetor"]) assert.equal((await call("", { user: { ...STAFF, role } })).status, 403);
  assert.deepEqual(calls, []);
  assert.equal((await call("", { user: DENIED })).status, 403);
  assert.equal((await call("/1/read", { user: DENIED, method: "POST" })).status, 403);
  assert.equal(calls.every((sql) => sql.includes("SELECT value FROM config")), true);
});

test("feed, opening and individual read receipts respect the municipal and recipient scopes", async (t) => {
  const { call, reads, calls } = await fixture(t);
  const list = await call(`?municipalityId=${REMOTE}`, { user: STAFF });
  assert.equal(list.cache, "no-store");
  assert.deepEqual(list.body.items.map(({ id, read }) => [id, read]), [["3", false], ["1", false]]);
  assert.equal(list.body.unreadCount, 2);
  assert.deepEqual(Object.keys(list.body.items[0]).sort(), ["createdAt", "id", "municipalityId", "protocol", "read", "requestId", "type"]);
  for (const id of ["2", "4", "999", "9223372036854775808"]) {
    assert.equal((await call(`/${id}/read`, { user: STAFF, method: "POST" })).status, 404);
  }
  assert.equal(reads.size, 0);
  assert.ok(calls.includes("ROLLBACK"));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const opened = await call("/1/read", { user: STAFF, method: "POST" });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.unreadCount, 1);
    assert.equal(opened.body.request.is_confidential, true);
    assert.deepEqual(opened.body.request.workflow_data, { public: "value" });
  }
  assert.equal(reads.size, 1);
  const colleague = await call("", { user: COLLEAGUE });
  assert.deepEqual(colleague.body.items.map(({ id, read }) => [id, read]), [["4", false], ["1", false]]);
  assert.equal(colleague.body.unreadCount, 2);
});

test("global staff may filter visible municipal events and page without seeing private assignments", async (t) => {
  const { call } = await fixture(t, [
    ...Array.from({ length: 21 }, (_, index) => event(index + 1, LOCAL)),
    event(22, REMOTE), event(23, REMOTE, STAFF.id), event(24, REMOTE, null, { unavailable: true }),
  ]);
  const scoped = await call(`?municipalityId=${REMOTE}`, { user: GLOBAL });
  assert.deepEqual(scoped.body.items.map(({ id }) => id), ["22"]);
  const first = await call("", { user: GLOBAL });
  assert.equal(first.body.items.length, 20);
  assert.equal(first.body.nextCursor, "3");
  const second = await call(`?cursor=${first.body.nextCursor}`, { user: GLOBAL });
  assert.deepEqual(second.body.items.map(({ id }) => id), ["2", "1"]);
  assert.equal(second.body.nextCursor, null);
  assert.equal(second.body.unreadCount, 22);
  assert.equal((await call("?cursor=9223372036854775808", { user: GLOBAL })).status, 400);
  assert.equal((await call("?municipalityId=invalid", { user: GLOBAL })).status, 400);
});
