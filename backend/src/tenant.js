export const GLOBAL_ROLES = new Set(["master", "suporte"]);
export const MUNICIPALITY_ADMIN_ROLE = "admin_municipal";

export function normalizeRole(role = "") {
  return String(role || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isGlobalUser(user = {}) {
  return GLOBAL_ROLES.has(normalizeRole(user.role));
}

export function pickMunicipalityId(req) {
  if (!req.user) {
    return req.query?.municipalityId || req.body?.municipalityId || req.body?.municipality_id || null;
  }
  if (isGlobalUser(req.user)) {
    return req.query?.municipalityId || req.body?.municipalityId || req.body?.municipality_id || null;
  }
  return req.user?.municipalityId || req.user?.municipality_id || null;
}

export function requireMunicipality(req, res) {
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId) {
    res.status(400).json({ error: "Municipio obrigatorio para esta operacao." });
    return null;
  }
  return municipalityId;
}
