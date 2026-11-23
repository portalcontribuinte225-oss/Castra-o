import test from "node:test";
import assert from "node:assert/strict";
import { isEmailAccountConfigured, readEmailAccount } from "../src/services/email-account.js";
import { publicOrigin, readPublicUrl } from "../src/services/public-url.js";
import { ServerCredential } from "../../shared/server-credential-contract.js";
import { clearServerCredentials, TEST_EMAIL_CREDENTIALS, useServerCredentials } from "./fixtures/server-credentials.js";

clearServerCredentials();

const { EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, APP_PUBLIC_URL } = ServerCredential;
const PRIVATE_KEY = "private-key-for-tests-only";
const env = {
  [EMAILJS_SERVICE_ID]: " service_test ", [EMAILJS_PUBLIC_KEY]: "public-key-test", [EMAILJS_PRIVATE_KEY]: ` ${PRIVATE_KEY} `,
  [APP_PUBLIC_URL]: "https://system.example.test/some/path?x=1",
};

test("the account comes from the server's variables, trimmed, with the address kept as an origin", () => {
  const account = readEmailAccount(env);
  assert.deepEqual(account, { serviceId: "service_test", publicKey: "public-key-test", privateKey: PRIVATE_KEY, publicUrl: "https://system.example.test" });
  assert.equal(isEmailAccountConfigured(account), true);
});

test("sending needs the service, the public key and the private key; the address is optional", () => {
  for (const name of [EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY]) {
    assert.equal(isEmailAccountConfigured(readEmailAccount({ ...env, [name]: "" })), false, name);
  }
  assert.equal(isEmailAccountConfigured(readEmailAccount({ ...env, [APP_PUBLIC_URL]: "" })), true);
  assert.deepEqual(readEmailAccount({}), { serviceId: "", publicKey: "", privateKey: "", publicUrl: "" });
});

test("a malformed value counts as absent", () => {
  const cases = [[EMAILJS_SERVICE_ID, "service id", "serviceId"], [EMAILJS_SERVICE_ID, "x".repeat(201), "serviceId"], [EMAILJS_PUBLIC_KEY, "has space", "publicKey"],
    [EMAILJS_PUBLIC_KEY, "x".repeat(201), "publicKey"], [EMAILJS_PRIVATE_KEY, "has space", "privateKey"], [APP_PUBLIC_URL, "sistema.example.test", "publicUrl"],
    [APP_PUBLIC_URL, "http://system.example.test", "publicUrl"], [APP_PUBLIC_URL, "ftp://system.example.test", "publicUrl"],
    [APP_PUBLIC_URL, "https://user:pass@system.example.test", "publicUrl"]];
  for (const [name, value, field] of cases) assert.equal(readEmailAccount({ ...env, [name]: value })[field], "", `${name}=${value}`);
});

test("the public address keeps only the origin and allows plain http for a local address only", () => {
  assert.equal(publicOrigin("https://system.example.test/a/b?c=d#e"), "https://system.example.test");
  assert.equal(publicOrigin(" https://system.example.test:8443 "), "https://system.example.test:8443");
  assert.equal(publicOrigin("http://localhost:3002/x"), "http://localhost:3002");
  assert.equal(publicOrigin("http://127.0.0.1:3002"), "http://127.0.0.1:3002");
  for (const refused of ["", undefined, "http://system.example.test", "sistema.example.test", "https://user:pass@system.example.test"]) assert.equal(publicOrigin(refused), "");
  assert.deepEqual(readPublicUrl({}), { url: "" });
  assert.deepEqual(readPublicUrl({ [APP_PUBLIC_URL]: "https://system.example.test/" }), { url: "https://system.example.test" });
});

test("by default the account is read from the environment of the process", (t) => {
  assert.equal(isEmailAccountConfigured(readEmailAccount()), false);
  useServerCredentials(t, TEST_EMAIL_CREDENTIALS);
  assert.equal(isEmailAccountConfigured(readEmailAccount()), true);
});
