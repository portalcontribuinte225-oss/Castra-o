import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { AuthAudience, AuthPurpose, buildDefaultAuthDeliveryConfig } from "../../shared/auth-contract.js";
import { NotificationChannel } from "../../shared/notification-contract.js";
import { createRecoveryToken, readRecoveryToken, matchesRecoveryUser, recoveryDestination, recoveryOptionId } from "../src/services/auth/recovery-token.js";
import { getRecoveryOptions } from "../src/services/auth/recovery-channels.js";
import { pool } from "../src/db/index.js";
import { authHttpFixture, authUser, AUTH_TEST_MUNICIPALITY as MUNICIPALITY, AUTH_TEST_OTHER_MUNICIPALITY as OTHER } from "./fixtures/auth-http.js";

const context = { audience: AuthAudience.TUTOR, municipalityId: MUNICIPALITY };
function secret(t) {
  const old = process.env.JWT_SECRET; process.env.JWT_SECRET = "recovery-options-tests";
  t.after(() => { if (old === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = old; });
}

test("discovery token and option IDs bind account revisions, context, expiry and destination without exposing contacts", (t) => {
  secret(t);
  const user = authUser(); const now = Date.now(); const token = createRecoveryToken(user, now);
  const claims = readRecoveryToken(token, context, now);
  assert.equal(matchesRecoveryUser(claims, user), true);
  for (const changed of [{ profile_version: 1 }, { session_version: 1 }, { password: "changed" }, { active: false },
    { municipality_id: OTHER }, { role: "analista" }]) assert.equal(matchesRecoveryUser(claims, { ...user, ...changed }), false);
  for (const altered of [token + "suffix", "x" + token, token.split(".")[0], token + ".extra"]) {
    assert.throws(() => readRecoveryToken(altered, context, now), { status: 400 });
  }
  assert.throws(() => readRecoveryToken(token, { ...context, municipalityId: OTHER }, now), { status: 400 });
  assert.throws(() => readRecoveryToken(token, { audience: AuthAudience.STAFF }, now), { status: 400 });
  assert.throws(() => readRecoveryToken(token, context, now + 600001), { status: 400 });
  assert.doesNotMatch(Buffer.from(token.split(".")[0], "base64url").toString(), /tutor@example|52998224725/);
  assert.notEqual(recoveryOptionId(token, "email", user.profile_email), recoveryOptionId(token, "sms", user.profile_email));
  assert.notEqual(recoveryOptionId(token, "email", user.profile_email), recoveryOptionId(token, "email", "other@example.test"));
});

test("availability lists unverified cadastral contacts only with active configured channels and does not consume quota", async (t) => {
  secret(t);
  const user = authUser({ profile_phone: "48999991234" }); const config = buildDefaultAuthDeliveryConfig();
  config.whatsappTemplates.password_reset = "authentication";
  const deps = { env: { EMAILJS_SERVICE_ID: "test", EMAILJS_PUBLIC_KEY: "test", EMAILJS_TEMPLATE_ID: "reset" },
    loadConfig: async () => config, loadWhatsapp: async () => ({ active: true, accessToken: "test", phoneNumberId: "test" }),
    quotaAvailable: async () => true, smsAvailable: async () => ({ available: true }) };
  const options = await getRecoveryOptions(user, createRecoveryToken(user), deps);
  assert.deepEqual(options.map(item => item.channel), Object.values(NotificationChannel));
  assert.equal(options[1].maskedDestination, "(48) *****-1234");
  assert.doesNotMatch(JSON.stringify(options), /tutor@example|48999991234/);
  assert.deepEqual((await getRecoveryOptions(user, "handle", { ...deps, loadWhatsapp: async () => ({ active: false }),
    smsAvailable: async () => ({ available: false }) })).map(item => item.channel), [NotificationChannel.EMAIL]);
  assert.deepEqual((await getRecoveryOptions(user, "handle", { ...deps, quotaAvailable: async () => false })).map(item => item.channel), [NotificationChannel.EMAIL, NotificationChannel.SMS]);
});

test("availability inside a transaction uses the supplied client for every read without borrowing another pool connection", async (t) => {
  secret(t);
  const original = pool.query;
  pool.query = async () => { throw new Error("Nested pool borrow while holding a transaction"); };
  t.after(() => { pool.query = original; });
  const queried = [];
  const database = { query: async (_sql, values) => {
    assert.equal(values[1], MUNICIPALITY); queried.push(values[0]);
    const valuesByKey = { "whatsapp": { active: true, accessToken: "test", phoneNumberId: "test" },
      "whatsapp_quota": { plan: 10 }, "castragestao:auth-delivery": { whatsappTemplates: { password_reset: "auth" } } };
    return { rows: valuesByKey[values[0]] ? [{ value: valuesByKey[values[0]] }] : [] };
  } };
  const options = await getRecoveryOptions(authUser({ profile_phone: "48999991234" }), "handle", { database, env: {} });
  assert.deepEqual(options.map(item => item.channel), [NotificationChannel.WHATSAPP]);
  assert.equal(queried.includes("castragestao:sms"), true);
});

test("discovery sends nothing; explicit choice sends one code, enforces cooldown and confirms only used contact", async (t) => {
  const user = authUser({ profile_phone: "48999991234" }); const f = await authHttpFixture(t, [user], { emailEnabled: true });
  const oldSession = f.token(user);
  const discovery = await f.request("/auth/recovery-options", { method: "POST", body: { ...context, identifier: user.cpf } });
  assert.equal(discovery.status, 200); assert.equal(f.messages.length, 0); assert.equal(f.challenges.size, 0);
  assert.equal(discovery.body.options[0].channel, "email");
  const body = { ...context, recoveryToken: discovery.body.recoveryToken, optionId: discovery.body.options[0].id };
  const sent = await f.request("/auth/forgot-password", { method: "POST", body });
  assert.equal(sent.status, 200); assert.equal(sent.body.delivery[0].status, "sent");
  assert.equal(f.messages.length, 1); assert.equal(f.messages[0].template_params.to_email, user.profile_email);
  assert.equal(new Date(sent.body.expiresAt) - new Date(sent.body.retryAt), 540000);
  assert.equal((await f.request("/auth/forgot-password", { method: "POST", body })).status, 429);
  const code = f.messages[0].template_params.code;
  assert.equal((await f.request("/auth/reset-password", { method: "POST", body: { ...context, challengeId: sent.body.challengeId,
    password: "123456", code: code === "111111" ? "222222" : "111111" } })).status, 400);
  assert.equal(f.users.get(user.id).email_verified_at, null);
  const reset = await f.request("/auth/reset-password", { method: "POST", body: { ...context, challengeId: sent.body.challengeId, password: "123456", code } });
  assert.equal(reset.status, 200); assert.ok(f.users.get(user.id).email_verified_at);
  assert.equal(f.users.get(user.id).phone_verified_at, null);
  assert.equal(await bcrypt.compare("123456", f.users.get(user.id).password), true);
  assert.equal((await f.request("/protected", { token: oldSession })).status, 401);
  f.limits.clear();
  assert.equal((await f.request("/auth/forgot-password", { method: "POST", body })).status, 400);
});

test("shared email asks for CPF and stale or forged selection never delivers", async (t) => {
  const user = authUser(); const other = authUser({ cpf: "11144477735" });
  const f = await authHttpFixture(t, [user, other], { emailEnabled: true });
  const ambiguous = await f.request("/auth/recovery-options", { method: "POST", body: { ...context, identifier: user.profile_email } });
  assert.equal(ambiguous.body.code, "CPF_REQUIRED");
  const discovery = await f.request("/auth/recovery-options", { method: "POST", body: { ...context, identifier: user.cpf } });
  const body = { ...context, recoveryToken: discovery.body.recoveryToken, optionId: "f".repeat(64) };
  assert.equal((await f.request("/auth/forgot-password", { method: "POST", body })).status, 400);
  f.limits.clear(); f.users.get(user.id).profile_version += 1;
  assert.equal((await f.request("/auth/forgot-password", { method: "POST", body: { ...body, optionId: discovery.body.options[0].id } })).status, 400);
  assert.equal(f.messages.length, 0); assert.equal(f.challenges.size, 0);
});

test("reset requires destination binding, rejects redirected contacts and audit failure rolls back verification and password", async (t) => {
  const user = authUser(); const f = await authHttpFixture(t, [user], { failAudit: true });
  const legacy = await f.challenge(user, AuthPurpose.PASSWORD_RESET);
  const request = pending => f.request("/auth/reset-password", { method: "POST", body: { ...context, challengeId: pending.challenge.id, code: pending.code, password: "abcdef" } });
  assert.equal((await request(legacy)).status, 400);
  const redirected = await f.challenge(user, AuthPurpose.PASSWORD_RESET, recoveryDestination("email", "other@example.test"));
  assert.equal((await request(redirected)).status, 400);
  const pending = await f.challenge(user, AuthPurpose.PASSWORD_RESET, recoveryDestination("email", user.profile_email));
  assert.equal((await request(pending)).status, 500);
  assert.equal(f.users.get(user.id).password, user.password);
  assert.equal(f.users.get(user.id).email_verified_at, null);
  assert.equal(f.challenges.get(pending.challenge.id).consumed_at, null);
});

test("successful SMS recovery confirms only the selected phone and rejects a different municipality", async (t) => {
  const user = authUser({ profile_phone: "48999991234" }); const f = await authHttpFixture(t, [user]);
  const pending = await f.challenge(user, AuthPurpose.PASSWORD_RESET, recoveryDestination(NotificationChannel.SMS, user.profile_phone));
  const body = { ...context, challengeId: pending.challenge.id, code: pending.code, password: "abcdef" };
  assert.equal((await f.request("/auth/reset-password", { method: "POST", body: { ...body, municipalityId: OTHER } })).status, 400);
  assert.equal((await f.request("/auth/reset-password", { method: "POST", body })).status, 200);
  assert.ok(f.users.get(user.id).phone_verified_at);
  assert.equal(f.users.get(user.id).email_verified_at, null);
});
