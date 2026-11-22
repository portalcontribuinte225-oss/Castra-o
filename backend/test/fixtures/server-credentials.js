import { ServerCredential, WHATSAPP_TOKEN_VARIABLE_PREFIX } from "../../../shared/server-credential-contract.js";

const NAMES = new Set(Object.values(ServerCredential));
const isCredential = (name) => NAMES.has(name) || name.startsWith(WHATSAPP_TOKEN_VARIABLE_PREFIX);

// The app loads the local .env on import, and it may hold real integration credentials. Tests never use them: a file that reaches
// an integration clears them right after its imports and sets only fake values.
export function clearServerCredentials() {
  for (const name of Object.keys(process.env)) if (isCredential(name)) delete process.env[name];
}

// Leaves only the given fake credentials in the environment; the answer puts the previous ones back.
export function replaceServerCredentials(values = {}) {
  const previous = Object.fromEntries(Object.keys(process.env).filter(isCredential).map((name) => [name, process.env[name]]));
  clearServerCredentials();
  Object.assign(process.env, values);
  return () => {
    clearServerCredentials();
    Object.assign(process.env, previous);
  };
}

// Fake credentials for one test, added to the current ones and restored when it ends.
export function useServerCredentials(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  Object.assign(process.env, values);
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
}

// A complete fake EmailJS account and public address, as the e-mail tests need.
export const TEST_EMAIL_CREDENTIALS = Object.freeze({
  [ServerCredential.EMAILJS_SERVICE_ID]: "test-service",
  [ServerCredential.EMAILJS_PUBLIC_KEY]: "test-public",
  [ServerCredential.EMAILJS_PRIVATE_KEY]: "test-private",
});
