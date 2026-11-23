// One SMS message the municipality can turn on, as the server lists it.
export interface SmsUseRow {
  key: string;
  kind: string;
  label: string;
  active: boolean;
}

// What the screen reads: whether the server holds a production token (never the token), plus the municipality's name and messages.
export interface SmsConfig {
  integrated: boolean;
  municipalityName: string;
  uses: SmsUseRow[];
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
  loading: boolean;
  saving: boolean;
  ready: boolean;
  testPhone: string;
  sendingTest: boolean;
  testOutcome: SmsTestOutcome | null;
  error: string;
}

export interface SmsSettingsApi {
  getSmsSettings: (municipalityId: string) => Promise<unknown>;
  setSmsUseActive: (municipalityId: string, use: string, active: boolean) => Promise<unknown>;
  sendSmsTest: (municipalityId: string, phone: string) => Promise<SmsTestAnswer>;
}
