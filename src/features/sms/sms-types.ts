import { SmsEnvironment, SmsProvider } from "../../../shared/sms-contract.js";

export interface SmsConfig {
  provider: typeof SmsProvider.SMSMAIS;
  active: boolean;
  hasToken: boolean;
  environment: typeof SmsEnvironment[keyof typeof SmsEnvironment] | null;
  tokenValid: boolean;
  lastValidatedAt: string | null;
  secureStorageAvailable?: boolean;
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
  active: boolean;
  token: string;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  ready: boolean;
  error: string;
  notice: string;
  connection: SmsConnectionResult | null;
}

export interface SmsSettingsApi {
  getConfig: (key: string, municipalityId: string) => Promise<unknown>;
  setConfig: (key: string, value: { active?: boolean; token?: string; clearToken?: boolean }, municipalityId: string) => Promise<{ value?: unknown }>;
  testSmsConnection: (body: { municipalityId: string; token?: string }) => Promise<SmsConnectionResult>;
}
