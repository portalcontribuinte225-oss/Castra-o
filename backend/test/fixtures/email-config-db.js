// Fake pg access for the e-mail configuration: config rows (platform rows use the key `<key>:null`), municipalities and the audit log.
export function fakeEmailDatabase({ configs = {}, municipalities = {} } = {}) {
  const store = new Map(Object.entries(configs));
  const calls = [];
  const audits = [];
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql) || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.includes("SELECT value FROM config")) {
      const value = store.get(`${values[0]}:${values[1]}`);
      return { rows: value === undefined ? [] : [{ value }] };
    }
    if (sql.includes("INSERT INTO config")) { store.set(`${values[0]}:${values[1]}`, JSON.parse(values[2])); return { rows: [] }; }
    if (sql.includes("INSERT INTO audit_logs")) {
      audits.push({ userId: values[0], municipalityId: values[2], action: values[3], entityId: values[5], changes: values[6] ? JSON.parse(values[6]) : null });
      return { rows: [] };
    }
    const image = /^SELECT (brasao|department_logo) AS image FROM municipalities/.exec(sql);
    if (image) {
      const row = municipalities[values[0]];
      return { rows: row && row.active !== false ? [{ image: row[image[1]] }] : [] };
    }
    if (sql.includes("FROM municipalities WHERE id = $1")) {
      const row = municipalities[values[0]];
      return { rows: row ? [{ id: values[0], has_brasao: Boolean(row.brasao), has_department_logo: Boolean(row.department_logo), ...row }] : [] };
    }
    throw new Error("Unexpected test database operation");
  };
  return { store, calls, audits, query, connect: async () => ({ query, release() {} }) };
}

// A valid 32-byte key, so secrets can be encrypted in tests without touching the real environment.
export function useTestEncryptionKey(t) {
  const previous = process.env.CONFIG_ENCRYPTION_KEY;
  process.env.CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  t.after(() => { if (previous === undefined) delete process.env.CONFIG_ENCRYPTION_KEY; else process.env.CONFIG_ENCRYPTION_KEY = previous; });
}
