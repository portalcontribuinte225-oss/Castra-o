// A server variable of the account that is missing or malformed, by name.
export interface EmailCredentialIssue {
  variable: string;
  problem: string;
}

// What the master sees of the account, read from the server's variables: the private key itself never arrives, only how it starts.
export interface EmailAccountView {
  serviceId: string;
  publicKey: string;
  publicUrl: string;
  privateKeyPreview: string;
  issues: EmailCredentialIssue[];
}

// One message the system can send by e-mail. Ids and variables come only for the master.
export interface EmailUseRow {
  key: string;
  kind: string;
  label: string;
  variables?: string[];
  templateId?: string;
  configured: boolean;
  active: boolean;
}

export interface EmailIdentitySummary {
  name: string;
  departmentName: string;
  brasao: string;
  departmentLogo: string;
}

export interface EmailSettings {
  account: EmailAccountView | null;
  configured: boolean;
  municipal: boolean;
  uses: EmailUseRow[];
  identity: EmailIdentitySummary | null;
}

