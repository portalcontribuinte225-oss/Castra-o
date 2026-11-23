import type { ContractState } from "../../../shared/message-quota-contract.js";

// What the server tells about the contract of one channel for one municipality: the plan, the month's usage, the dates and where
// it stands today.
export interface MessageQuotaStatus {
  plan: number;
  used: number;
  contractStart: string | null;
  contractEnd: string | null;
  state: (typeof ContractState)[keyof typeof ContractState];
}

// What a save carries: the monthly limit, the dates (empty when the contract has none) and whether the contract is on.
export interface MessageQuotaInput {
  plan: number;
  contractStart: string;
  contractEnd: string;
  enabled: boolean;
}
