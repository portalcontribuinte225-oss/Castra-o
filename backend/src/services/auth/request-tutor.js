import { normalizeCpf } from "../../utils.js";
import { authError } from "./auth-security.js";

// Called only inside the request transaction. A logged tutor sends the request on their own account, with the CPF of their
// profile. Anyone else sends it without an account: the tutor's account is born on the first access, with the code to create the
// password ("Acessar minha solicitação").
export async function resolveRequestTutor(client, { cpf, municipalityId, user }) {
  if (user?.role !== "tutor") return null;
  const { rows } = await client.query("SELECT cpf FROM tutor_profiles WHERE user_id = $1 AND municipality_id = $2", [user.id, municipalityId]);
  if (!rows[0] || rows[0].cpf !== normalizeCpf(cpf)) throw authError(403, "O CPF deve corresponder ao seu perfil de tutor.");
  return user.id;
}
