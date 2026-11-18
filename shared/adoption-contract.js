// The stages of an animal in the adoption program, as the adoption screen stores them.
export const AdoptionStatus = Object.freeze({
  AVAILABLE: "disponivel",
  IN_PROGRESS: "em_processo",
  ADOPTED: "adotado",
});

// The largest photo the adoption form accepts.
export const MAX_ADOPTION_PHOTO_BYTES = 2 * 1024 * 1024;

// The public address of an animal for adoption: the share button builds it and the server answers it with a preview.
export const ADOPTION_SHARE_PREFIX = "/adocao/";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function adoptionSharePath(id) {
  return `${ADOPTION_SHARE_PREFIX}${encodeURIComponent(String(id || ""))}`;
}

// The animal an opened address points to, or "" when it is not an adoption link.
export function readAdoptionShareId(pathname) {
  const match = /^\/adocao\/([^/?#]+)\/?$/.exec(String(pathname || ""));
  if (!match) return "";
  try {
    const id = decodeURIComponent(match[1]);
    return UUID_PATTERN.test(id) ? id : "";
  } catch {
    return "";
  }
}
