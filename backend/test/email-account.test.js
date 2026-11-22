import test from "node:test";
import assert from "node:assert/strict";
import { isEmailAccountConfigured, publicEmailAccount, readEmailAccount } from "../src/services/email-account.js";
import { publicOrigin, readPublicUrl } from "../src/services/public-url.js";
import { SECRET_PREVIEW_LENGTH } from "../../shared/secret-preview-contract.js";
import { CredentialIssue, ServerCredential } from "../../shared/server-credential-contract.js";
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
  assert.deepEqual(account, { serviceId: "service_test", publicKey: "public-key-test", privateKey: PRIVATE_KEY, publicUrl: "https://system.example.test", issues: [] });
  assert.equal(isEmailAccountConfigured(account), true);
});

test("sending needs the service, the public key and the private key; the address is optional", () => {
  for (const name of [EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY]) {
    const account = readEmailAccount({ ...env, [name]: "" });
    assert.equal(isEmailAccountConfigured(account), false, name);
    assert.deepEqual(account.issues, [{ variable: name, problem: CredentialIssue.MISSING }]);
  }
  assert.equal(isEmailAccountConfigured(readEmailAccount({ ...env, [APP_PUBLIC_URL]: "" })), true);
  assert.deepEqual(readEmailAccount({}).issues.map(({ variable }) => variable), [EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, APP_PUBLIC_URL]);
});

test("a malformed value counts as absent and is named by its variable", () => {
  const cases = [[EMAILJS_SERVICE_ID, "service id", "serviceId"], [EMAILJS_SERVICE_ID, "x".repeat(201), "serviceId"], [EMAILJS_PUBLIC_KEY, "has space", "publicKey"],
    [EMAILJS_PUBLIC_KEY, "x".repeat(201), "publicKey"], [EMAILJS_PRIVATE_KEY, "has space", "privateKey"], [APP_PUBLIC_URL, "sistema.example.test", "publicUrl"],
    [APP_PUBLIC_URL, "http://system.example.test", "publicUrl"], [APP_PUBLIC_URL, "ftp://system.example.test", "publicUrl"],
    [APP_PUBLIC_URL, "https://user:pass@system.example.test", "publicUrl"]];
  for (const [name, value, field] of cases) {
    const account = readEmailAccount({ ...env, [name]: value });
    assert.deepEqual(account.issues, [{ variable: name, problem: CredentialIssue.INVALID }], `${name}=${value}`);
    assert.equal(account[field], "", `${name}=${value}`);
  }
});

test("the public address keeps only the origin and allows plain http for a local address only", () => {
  assert.equal(publicOrigin("https://system.example.test/a/b?c=d#e"), "https://system.example.test");
  assert.equal(publicOrigin(" https://system.example.test:8443 "), "https://system.example.test:8443");
  assert.equal(publicOrigin("http://localhost:3002/x"), "http://localhost:3002");
  assert.equal(publicOrigin("http://127.0.0.1:3002"), "http://127.0.0.1:3002");
  for (const refused of ["", undefined, "http://system.example.test", "sistema.example.test", "https://user:pass@system.example.test"]) assert.equal(publicOrigin(refused), "");
  assert.deepEqual(readPublicUrl({}), { url: "", issue: CredentialIssue.MISSING });
  assert.deepEqual(readPublicUrl({ [APP_PUBLIC_URL]: "https://system.example.test/" }), { url: "https://system.example.test", issue: null });
});

test("what the screen reads never carries the private key, only how it starts and which variables to fix", () => {
  const view = publicEmailAccount(readEmailAccount({ ...env, [APP_PUBLIC_URL]: "" }));
  assert.deepEqual(view, {
    serviceId: "service_test", publicKey: "public-key-test", publicUrl: "", privateKeyPreview: PRIVATE_KEY.slice(0, SECRET_PREVIEW_LENGTH),
    issues: [{ variable: APP_PUBLIC_URL, problem: CredentialIssue.MISSING }],
  });
  assert.equal(JSON.stringify(view).includes(PRIVATE_KEY), false);
});

test("by default the account is read from the environment of the process", (t) => {
  assert.equal(isEmailAccountConfigured(readEmailAccount()), false);
  useServerCredentials(t, TEST_EMAIL_CREDENTIALS);
  assert.equal(isEmailAccountConfigured(readEmailAccount()), true);
});
