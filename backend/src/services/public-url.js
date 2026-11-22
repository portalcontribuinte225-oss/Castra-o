import { ServerCredential } from "../../../shared/server-credential-contract.js";
import { readServerCredential } from "./server-credentials.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

// The public address is kept as an origin: no path, query or credentials. Plain http is accepted for a local address only, so a
// published system is always reached over https. Anything else answers empty.
export function publicOrigin(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    return "";
  }
  const allowed = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname));
  return allowed && !url.username && !url.password ? url.origin : "";
}

// The address of the system (APP_PUBLIC_URL) that builds the links and images leaving in messages. Without it they go without them.
export function readPublicUrl(env = process.env) {
  const { value, issue } = readServerCredential(ServerCredential.APP_PUBLIC_URL, (text) => Boolean(publicOrigin(text)), env);
  return { url: value ? publicOrigin(value) : "", issue };
}
