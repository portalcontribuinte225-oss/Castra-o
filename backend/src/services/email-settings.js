import { isEmailAccountConfigured, loadEmailAccount, publicEmailAccount } from "./email-account.js";
import { loadEmailIdentitySummary } from "./email-identity.js";
import { listEmailUses } from "./email-templates.js";

// What the e-mail screen reads. The master also gets the account and the template ids; everyone else only the municipal view.
export async function getEmailSettings({ municipalityId = null, master = false, database } = {}) {
  const account = await loadEmailAccount(database);
  const [uses, identity] = await Promise.all([
    listEmailUses({ account, municipalityId, master, database }),
    municipalityId ? loadEmailIdentitySummary(municipalityId, account.publicUrl, { database }) : null,
  ]);
  return {
    account: master ? publicEmailAccount(account) : null,
    configured: isEmailAccountConfigured(account),
    municipal: Boolean(municipalityId),
    uses,
    identity,
  };
}
