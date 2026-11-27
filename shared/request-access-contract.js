// How long the page "Acompanhar solicitação" stays open after the code: enough to see the requests, download their documents and
// create the password. It opens the requests of one CPF in one municipality and is never a session.
export const REQUEST_ACCESS_TOKEN_SECONDS = 900;

// The code sent to open the page: six digits.
export const ACCESS_CODE_PATTERN = /^\d{6}$/;

// The address that opens that page: `/?m=<municipality slug>&acessar`.
export const AccessLinkParam = Object.freeze({ MUNICIPALITY: "m", ACCESS: "acessar" });

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

function readSlug(value) {
  return typeof value === "string" && value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value) ? value : "";
}

// Empty when the slug is malformed.
export function buildAccessPath({ slug }) {
  const municipality = readSlug(slug);
  return municipality ? `/?${AccessLinkParam.MUNICIPALITY}=${municipality}&${AccessLinkParam.ACCESS}` : "";
}

// The whole link, on the public address of the system. Empty when that address is missing or is not http(s).
export function buildAccessUrl({ publicUrl, slug }) {
  const path = buildAccessPath({ slug });
  if (!path) return "";
  let base;
  try { base = new URL(String(publicUrl || "")); } catch { return ""; }
  return base.protocol === "https:" || base.protocol === "http:" ? `${base.origin}${path}` : "";
}

// What an address brings: null when it is not an access link; otherwise the slug, empty when malformed, so a bad link still opens
// the page. Links sent before the access by CPF carried the protocol as the value of `acessar`; it is ignored.
export function readAccessLink(search) {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  if (!params.has(AccessLinkParam.ACCESS)) return null;
  return { slug: readSlug(params.get(AccessLinkParam.MUNICIPALITY)) };
}
