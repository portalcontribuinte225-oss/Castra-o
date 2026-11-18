// What the master sees of the account: the private key itself never arrives, only whether it exists and how it starts.
export interface EmailAccountView {
  serviceId: string;
  publicKey: string;
  publicUrl: string;
  hasPrivateKey: boolean;
  privateKeyPreview: string;
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

export interface EmailAccountInput {
  serviceId?: string;
  publicKey?: string;
  privateKey?: string;
  clearPrivateKey?: boolean;
  publicUrl?: string;
}
