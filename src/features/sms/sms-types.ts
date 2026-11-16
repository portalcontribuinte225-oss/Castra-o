import { SmsEnvironment, SmsProvider } from "../../../shared/sms-contract.js";

// One SMS message the municipality can turn on, as the server lists it.
export interface SmsUseRow {
  key: string;
  kind: string;
  label: string;
  active: boolean;
}

export interface SmsConfig {
  provider: typeof SmsProvider.SMSMAIS;
  active: boolean;
  hasToken: boolean;
  // Only the start of the saved token; the token itself never arrives.
  tokenPreview: string;
  environment: typeof SmsEnvironment[keyof typeof SmsEnvironment] | null;
  tokenValid: boolean;
  lastValidatedAt: string | null;
  secureStorageAvailable?: boolean;
  municipalityName: string;
  uses: SmsUseRow[];
}

export interface SmsConnectionResult {
  valid: boolean;
  environment: SmsConfig["environment"];
  balance?: { credits: number; sms: number } | null;
  checkedAt: string;
  code?: string;
  reason?: string;
}

export interface SmsSettingsState {
  config: SmsConfig;
  token: string;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  ready: boolean;
  confirmingRemoval: boolean;
  error: string;
  notice: string;
  connection: SmsConnectionResult | null;
}

export interface SmsSettingsApi {
  getConfig: (key: string, municipalityId: string) => Promise<unknown>;
  setConfig: (key: string, value: { active?: boolean; token?: string; clearToken?: boolean }, municipalityId: string) => Promise<{ value?: unknown }>;
  testSmsConnection: (body: { municipalityId: string; token?: string }) => Promise<SmsConnectionResult>;
  setSmsUseActive: (municipalityId: string, use: string, active: boolean) => Promise<unknown>;
}
