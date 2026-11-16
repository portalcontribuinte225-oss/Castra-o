export const NEIGHBORHOODS_CONFIG_KEY = "castragestao:neighborhoods";

// A municipality starts without neighborhoods: its own names are registered in Configurações. While the list is empty the forms
// keep a free-text field (as they do for breeds), so a new municipality can receive requests before it is configured.
export function buildDefaultNeighborhoods() {
  return [];
}

export const normalizeNeighborhoodName = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// The active neighborhoods of a municipality (items without an owner are shared with every municipality).
export function activeNeighborhoods(neighborhoods, municipalityId) {
  return (Array.isArray(neighborhoods) ? neighborhoods : []).filter((item) => item && typeof item === "object" && !Array.isArray(item)
    && item.active !== false && typeof item.name === "string" && item.name.trim() !== ""
    && (!item.municipalityId || item.municipalityId === municipalityId));
}
