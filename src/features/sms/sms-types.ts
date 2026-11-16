import { SmsEnvironment, SmsProvider } from "../../../shared/sms-contract.js";

// One SMS message the municipality can turn on, as the server lists it.
export interface SmsUseRow {
  key: string;
  kind: string;
  label: string;
  active: boolean;
}

// What the screen reads. The master reads the platform's account; the municipal administration only whether the channel is on
// (the account fields come empty), plus the municipality's name and messages.
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

// What the master saves in the platform's account: the token, its removal or the channel switch.
export interface SmsAccountInput {
  active?: boolean;
  token?: string;
  clearToken?: boolean;
}

export interface SmsConnectionResult {
  valid: boolean;
  environment: SmsConfig["environment"];
  balance?: { credits: number; sms: number } | null;
  checkedAt: string;
  code?: string;
  reason?: string;
}

// What the server answers to a test send: whether it went and, when it did not, why.
export interface SmsTestAnswer {
  status?: string;
  reason?: string;
  detail?: string;
  providerMessageId?: string;
}

// What the screen shows under the test field. `sent` only means the provider took the message: the carrier delivers it.
export interface SmsTestOutcome {
  sent: boolean;
  reason: string;
  // Which field of the provider's answer did not match, when it was not the answer for the message (no text, number or token).
  detail: string;
  providerMessageId: string;
}

export interface SmsSettingsState {
  config: SmsConfig;
  token: string;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  ready: boolean;
  confirmingRemoval: boolean;
  testPhone: string;
  sendingTest: boolean;
  testOutcome: SmsTestOutcome | null;
  error: string;
  notice: string;
  connection: SmsConnectionResult | null;
}

export interface SmsSettingsApi {
  getSmsSettings: (municipalityId: string) => Promise<unknown>;
  saveSmsAccount: (input: SmsAccountInput, municipalityId: string) => Promise<unknown>;
  testSmsConnection: (body: { token?: string }) => Promise<SmsConnectionResult>;
  setSmsUseActive: (municipalityId: string, use: string, active: boolean) => Promise<unknown>;
  sendSmsTest: (municipalityId: string, phone: string) => Promise<SmsTestAnswer>;
}
