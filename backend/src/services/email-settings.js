import { isEmailAccountConfigured, readEmailAccount } from "./email-account.js";
import { loadEmailIdentitySummary } from "./email-identity.js";
import { listEmailUses } from "./email-templates.js";

// What the e-mail screen reads: whether the account is integrated (never any part of it), the messages (with the template ids for the
// master) and how the municipality appears in the e-mails.
export async function getEmailSettings({ municipalityId = null, master = false, database, env = process.env } = {}) {
  const account = readEmailAccount(env);
  const [uses, identity] = await Promise.all([
    listEmailUses({ account, municipalityId, master, database }),
    municipalityId ? loadEmailIdentitySummary(municipalityId, account.publicUrl, { database }) : null,
  ]);
  return {
    integrated: isEmailAccountConfigured(account),
    municipal: Boolean(municipalityId),
    uses,
    identity,
  };
}
