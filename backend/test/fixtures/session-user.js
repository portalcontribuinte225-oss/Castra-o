import { issueSession } from "../../src/services/auth/auth-session.js";

// Test-only rows model the same persisted identity checked by production middleware.
export function sessionUser(claims = {}) {
  const municipalityId = claims.municipalityId ?? claims.municipality_id ?? null;
  return {
    id: claims.id || "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Test User",
    email: claims.role === "tutor" ? null : "staff@example.test", password: "test-only-credential-fingerprint",
    role: claims.role, municipality_id: municipalityId, municipality_active: true,
    active: true, must_change_password: false, session_version: 0,
    ...(claims.role === "tutor" ? { cpf: "52998224725", profile_email: "tutor@example.test", profile_version: 0 } : {}),
  };
}

export function registerTestSession(users, claims) {
  const user = sessionUser(claims);
  users.set(user.id, user);
  return issueSession(user).token;
}

export function resolveTestSession(sql, values, users) {
  if (sql.includes("FROM users u LEFT JOIN municipalities m") && sql.includes("WHERE u.id = $1")) {
    const user = users.get(values[0]);
    return { rows: user ? [structuredClone(user)] : [] };
  }
  return undefined;
}
