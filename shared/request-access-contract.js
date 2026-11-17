import { normalizeTrackingProtocol } from "./request-tracking-contract.js";

// How long the page "Acessar minha solicitação" stays open after the code: enough to download the request document and create
// the password. It opens one request of one municipality and is never a session.
export const REQUEST_ACCESS_TOKEN_SECONDS = 900;

// The address that opens that page: `/?m=<municipality slug>&acessar=<protocol>`.
export const AccessLinkParam = Object.freeze({ MUNICIPALITY: "m", PROTOCOL: "acessar" });

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

function readSlug(value) {
  return typeof value === "string" && value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value) ? value : "";
}

// The protocol is digits and one slash, so it goes as it is printed; the slug is plain too. Empty when either is malformed.
export function buildAccessPath({ slug, protocol }) {
  const municipality = readSlug(slug);
  const canonical = normalizeTrackingProtocol(protocol);
  return municipality && canonical ? `/?${AccessLinkParam.MUNICIPALITY}=${municipality}&${AccessLinkParam.PROTOCOL}=${canonical}` : "";
}

// The whole link, on the public address of the system. Empty when that address is missing or is not http(s).
export function buildAccessUrl({ publicUrl, slug, protocol }) {
  const path = buildAccessPath({ slug, protocol });
  if (!path) return "";
  let base;
  try { base = new URL(String(publicUrl || "")); } catch { return ""; }
  return base.protocol === "https:" || base.protocol === "http:" ? `${base.origin}${path}` : "";
}

// What an address brings: null when it is not an access link; otherwise the slug and the protocol, each empty when malformed, so a
// bad link still opens the page, just without filling it.
export function readAccessLink(search) {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  if (!params.has(AccessLinkParam.PROTOCOL)) return null;
  return { slug: readSlug(params.get(AccessLinkParam.MUNICIPALITY)), protocol: normalizeTrackingProtocol(params.get(AccessLinkParam.PROTOCOL)) || "" };
}
