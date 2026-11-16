// What the server tells about the contract of one channel for one municipality: the plan, the month's usage and the dates.
export interface MessageQuotaStatus {
  plan: number;
  used: number;
  remaining: number;
  contractStart: string | null;
  contractEnd: string | null;
  // Whether today is inside the dates of the contract (the balance of the month is another matter).
  active: boolean;
}

// What a save carries: the monthly limit and the dates, which stay empty when the contract has none.
export interface MessageQuotaInput {
  plan: number;
  contractStart: string;
  contractEnd: string;
}
