// One preview rule for every integration secret: only the start is ever shown, so the screen can tell which one is saved.
export const SECRET_PREVIEW_LENGTH = 8;

export function secretPreview(secret) {
  return String(secret ?? "").slice(0, SECRET_PREVIEW_LENGTH);
}
