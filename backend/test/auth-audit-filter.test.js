import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import auditRouter from "../src/routes/audit.js";
import { pool } from "../src/db/index.js";
import { AUDIT_ACTIONS } from "../src/services/audit.js";
import { registerTestSession, resolveTestSession } from "./fixtures/session-user.js";

test("administrators can filter the new security events without widening municipal scope", async (t) => {
  const oldQuery = pool.query;
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "audit-filter-test-only";
  const municipalityId = "11111111-1111-4111-8111-111111111111";
  const users = new Map();
  const token = registerTestSession(users, { role: "admin_municipal", municipalityId });
  const queries = [];
  pool.query = async (sql, values = []) => {
    const session = resolveTestSession(sql, values, users);
    if (session) return session;
    queries.push({ sql, values });
    return { rows: sql.includes("COUNT(*)") ? [{ total: "0" }] : [] };
  };
  const app = express(); app.use("/audit", auditRouter);
  const server = await new Promise((resolve) => { const running = app.listen(0, "127.0.0.1", () => resolve(running)); });
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    pool.query = oldQuery;
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  });
  for (const action of [AUDIT_ACTIONS.PASSWORD_CHANGE, AUDIT_ACTIONS.TUTOR_CONTACT_CHANGE, AUDIT_ACTIONS.TUTOR_ASSISTED_RECOVERY]) {
    queries.length = 0;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/audit?action=${action}`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.ok(queries.length > 0);
    for (const query of queries) {
      assert.match(query.sql, /municipality_id = \$1/);
      assert.match(query.sql, /action = \$2/);
      assert.deepEqual(query.values.slice(0, 2), [municipalityId, action]);
    }
  }
});
