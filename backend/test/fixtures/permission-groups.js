// A permission group as the municipality's configuration keeps it.
export const permissionGroup = (id, allowedConfigItems, extra = {}) => ({ id, name: id, active: true, allowedMenuItems: [], allowedConfigItems, ...extra });

// The team users and the permission groups of a municipality, as config rows (`<key>:<municipality>`), so a test can give a staff user a group.
export function permissionConfigs(municipalityId, { users = [], groups = [] } = {}) {
  return {
    [`castragestao:teams:${municipalityId}`]: { sectors: [], users },
    [`permission_groups:${municipalityId}`]: groups,
  };
}

// The permission reads a route makes before it answers; tests that count database access leave them out.
export const isPermissionRead = ({ values = [] }) => ["castragestao:teams", "permission_groups"].includes(values[0]);
