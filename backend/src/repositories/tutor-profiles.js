import { pool } from "../db/index.js";

export async function getTutorProfile(userId, municipalityId, database = pool) {
  const { rows } = await database.query(`SELECT p.*, u.name FROM tutor_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = $1 AND p.municipality_id = $2 AND u.role = 'tutor'`, [userId, municipalityId]);
  return rows[0] || null;
}

export function publicTutorProfile(profile) {
  return {
    id: profile.user_id, name: profile.name, cpf: profile.cpf, email: profile.email || "", phone: profile.phone || "",
    emailVerifiedAt: profile.email_verified_at || null, phoneVerifiedAt: profile.phone_verified_at || null,
    emailVerified: Boolean(profile.email_verified_at), phoneVerified: Boolean(profile.phone_verified_at),
    municipalityId: profile.municipality_id, version: profile.version,
  };
}

export async function saveVerifiedContact(database, { userId, municipalityId, kind, value }) {
  const email = kind === "email";
  const column = email ? "email" : "phone";
  const verified = email ? "email_verified_at" : "phone_verified_at";
  await database.query(`UPDATE tutor_profiles SET ${column} = $3, ${verified} = NOW(), version = version + 1, updated_at = NOW()
    WHERE user_id = $1 AND municipality_id = $2`, [userId, municipalityId, value]);
  await database.query(`UPDATE requests SET workflow_data = jsonb_set(workflow_data, '{followUp,${column}}', to_jsonb($3::text), true), updated_at = NOW()
    WHERE tutor_id = $1 AND municipality_id = $2 AND status IN ('NOVA', 'AGENDADA')
      AND workflow_data->'followUp'->>'enabled' = 'true'`, [userId, municipalityId, value]);
  await database.query("UPDATE auth_challenges SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL", [userId]);
}
