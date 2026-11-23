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

// Whether the platform's account is integrated (it lives in the server's variables and never reaches the screen), the messages and
// how the municipality appears in the e-mails.
export interface EmailSettings {
  integrated: boolean;
  municipal: boolean;
  uses: EmailUseRow[];
  identity: EmailIdentitySummary | null;
}
