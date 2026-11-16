import test from "node:test";
import assert from "node:assert/strict";
import { requireMaster } from "../src/middleware/auth.js";
import { GLOBAL_ROLES, MASTER_ROLE, isGlobalUser, isMasterUser } from "../src/tenant.js";

function run(user) {
  const result = { next: false, status: 0, body: null };
  const res = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
  requireMaster({ user }, res, () => { result.next = true; });
  return result;
}

test("only the master is the platform owner; the support is global but not master", () => {
  assert.equal(MASTER_ROLE, "master");
  assert.equal(GLOBAL_ROLES.has(MASTER_ROLE), true);
  assert.equal(isMasterUser({ role: "master" }), true);
  assert.equal(isMasterUser({ role: " Master " }), true);
  for (const role of ["suporte", "admin_municipal", "analista", "servidor_publico", "ong", "protetor", "tutor", "", undefined]) {
    assert.equal(isMasterUser({ role }), false, String(role));
  }
  assert.equal(isGlobalUser({ role: "suporte" }), true);
  assert.equal(isMasterUser(undefined), false);
  assert.equal(isMasterUser({}), false);
});

test("the master middleware lets only the master through and answers 401 without a session", () => {
  assert.deepEqual(run({ role: "master" }), { next: true, status: 0, body: null });
  assert.equal(run(undefined).status, 401);
  for (const role of ["suporte", "admin_municipal", "analista", "tutor"]) {
    const refused = run({ role });
    assert.equal(refused.next, false, role);
    assert.equal(refused.status, 403, role);
  }
});
