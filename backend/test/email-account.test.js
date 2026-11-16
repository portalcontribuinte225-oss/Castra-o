import test from "node:test";
import assert from "node:assert/strict";
import {
  getEmailRuntimeConfig, isEmailAccountConfigured, normalizePublicUrl, prepareEmailAccount, publicEmailAccount, saveEmailAccount,
} from "../src/services/email-account.js";
import { EMAIL_ACCOUNT_CONFIG_KEY } from "../../shared/email-contract.js";
import { SECRET_PREVIEW_LENGTH } from "../../shared/secret-preview-contract.js";
import { fakeEmailDatabase, useTestEncryptionKey } from "./fixtures/email-config-db.js";

const PRIVATE_KEY = "private-key-for-tests-only";
const input = { serviceId: " service_test ", publicKey: "public-key-test", privateKey: ` ${PRIVATE_KEY} `, publicUrl: "https://system.example.test/some/path?x=1" };

test("the account is stored trimmed, with the private key encrypted and only its start kept as preview", (t) => {
  useTestEncryptionKey(t);
  const stored = prepareEmailAccount({}, input);
  assert.equal(stored.serviceId, "service_test");
  assert.equal(stored.publicKey, "public-key-test");
  assert.equal(stored.publicUrl, "https://system.example.test");
  assert.match(stored.privateKey, /^enc:v1:/);
  assert.equal(stored.privateKeyPreview, PRIVATE_KEY.slice(0, SECRET_PREVIEW_LENGTH));
  assert.equal(JSON.stringify(stored).includes(PRIVATE_KEY), false);
});

test("what the screen may read never carries the private key, only whether it exists and how it starts", (t) => {
  useTestEncryptionKey(t);
  const view = publicEmailAccount(prepareEmailAccount({}, input));
  assert.deepEqual(view, { serviceId: "service_test", publicKey: "public-key-test", publicUrl: "https://system.example.test", hasPrivateKey: true, privateKeyPreview: PRIVATE_KEY.slice(0, SECRET_PREVIEW_LENGTH) });
  assert.equal(JSON.stringify(view).includes(PRIVATE_KEY), false);
  assert.deepEqual(publicEmailAccount(undefined), { serviceId: "", publicKey: "", publicUrl: "", hasPrivateKey: false, privateKeyPreview: "" });
});

test("a save without a new private key keeps the stored one, and clearing removes it with its preview", (t) => {
  useTestEncryptionKey(t);
  const stored = prepareEmailAccount({}, input);
  const kept = prepareEmailAccount(stored, { serviceId: "service_other" });
  assert.equal(kept.serviceId, "service_other");
  assert.equal(kept.privateKey, stored.privateKey);
  assert.equal(kept.publicUrl, stored.publicUrl);
  const cleared = prepareEmailAccount(stored, { clearPrivateKey: true });
  assert.deepEqual([cleared.privateKey, cleared.privateKeyPreview], ["", ""]);
  assert.equal(cleared.publicKey, "public-key-test");
});

test("invalid ids, keys and addresses are rejected before anything is stored", (t) => {
  useTestEncryptionKey(t);
  for (const bad of [{ serviceId: "service id" }, { serviceId: "x".repeat(201) }, { publicKey: "has space" }, { publicKey: "x".repeat(201) },
    { privateKey: "has space" }, { publicUrl: "sistema.example.test" }, { publicUrl: "http://system.example.test" }, { publicUrl: "ftp://system.example.test" },
    { publicUrl: "https://user:pass@system.example.test" }]) {
    assert.throws(() => prepareEmailAccount({}, bad), { status: 400 }, JSON.stringify(bad));
  }
});

test("the public address keeps only the origin, allows http for a local address and can be cleared", () => {
  assert.equal(normalizePublicUrl("https://system.example.test/a/b?c=d#e"), "https://system.example.test");
  assert.equal(normalizePublicUrl(" https://system.example.test:8443 "), "https://system.example.test:8443");
  assert.equal(normalizePublicUrl("http://localhost:3002/x"), "http://localhost:3002");
  assert.equal(normalizePublicUrl("http://127.0.0.1:3002"), "http://127.0.0.1:3002");
  assert.equal(normalizePublicUrl(""), "");
  assert.equal(normalizePublicUrl(undefined), "");
});

test("without secure storage the private key is refused with a message about the e-mail key", (t) => {
  const previous = process.env.CONFIG_ENCRYPTION_KEY;
  delete process.env.CONFIG_ENCRYPTION_KEY;
  t.after(() => { if (previous !== undefined) process.env.CONFIG_ENCRYPTION_KEY = previous; });
  assert.throws(() => prepareEmailAccount({}, { privateKey: PRIVATE_KEY }), (error) => error.status === 503 && /chave privada do e-mail/.test(error.message) && !/SMS/.test(error.message));
  assert.doesNotThrow(() => prepareEmailAccount({}, { serviceId: "service_test", publicKey: "public-key-test" }));
});

test("saving writes the platform row, audits the fields without any secret and answers with the safe view", async (t) => {
  useTestEncryptionKey(t);
  const database = fakeEmailDatabase();
  const view = await saveEmailAccount({ input, audit: { userId: "user-1", userEmail: "master@example.test", municipalityId: "municipality-a" }, database });
  assert.equal(view.hasPrivateKey, true);
  assert.equal(JSON.stringify(view).includes(PRIVATE_KEY), false);
  const row = database.store.get(`${EMAIL_ACCOUNT_CONFIG_KEY}:null`);
  assert.equal(row.serviceId, "service_test");
  assert.equal(JSON.stringify(row).includes(PRIVATE_KEY), false);
  assert.equal(database.audits.length, 1);
  assert.equal(database.audits[0].action, "EMAIL_ACCOUNT_UPDATE");
  assert.equal(database.audits[0].municipalityId, null);
  assert.deepEqual(database.audits[0].changes, { fields: ["serviceId", "publicKey", "privateKey", "publicUrl"] });
  assert.equal(JSON.stringify(database.audits).includes(PRIVATE_KEY), false);
  await assert.rejects(saveEmailAccount({ input: null, database }), { status: 400 });
  await assert.rejects(saveEmailAccount({ input: [], database }), { status: 400 });
});

test("the sender reads the account, with the private key decrypted, from the platform row", async (t) => {
  useTestEncryptionKey(t);
  const database = fakeEmailDatabase();
  assert.equal(isEmailAccountConfigured(await getEmailRuntimeConfig(database)), false);
  await saveEmailAccount({ input, database });
  const runtime = await getEmailRuntimeConfig(database);
  assert.deepEqual(runtime, { serviceId: "service_test", publicKey: "public-key-test", publicUrl: "https://system.example.test", privateKey: PRIVATE_KEY });
  assert.equal(isEmailAccountConfigured(runtime), true);
  const reads = database.calls.filter(({ sql }) => sql.includes("SELECT value FROM config"));
  assert.equal(reads.length > 0 && reads.every(({ values }) => values[0] === EMAIL_ACCOUNT_CONFIG_KEY && values[1] === null), true);
  assert.equal(isEmailAccountConfigured({ serviceId: "service_test" }), false);
  assert.equal(isEmailAccountConfigured({ publicKey: "public-key-test" }), false);
});

test("a stored private key that cannot be decrypted fails the read instead of sending without it", async (t) => {
  useTestEncryptionKey(t);
  const database = fakeEmailDatabase();
  await saveEmailAccount({ input, database });
  process.env.CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  await assert.rejects(getEmailRuntimeConfig(database), { status: 503 });
});

test("the environment never feeds the account", async () => {
  const names = ["EMAILJS_SERVICE_ID", "EMAILJS_PUBLIC_KEY", "EMAILJS_PRIVATE_KEY", "EMAILJS_TEMPLATE_ID"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) process.env[name] = "from-environment";
  try {
    assert.equal(isEmailAccountConfigured(await getEmailRuntimeConfig(fakeEmailDatabase())), false);
  } finally {
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
  }
});
