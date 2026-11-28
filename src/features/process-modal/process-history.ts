import type { RequestHistoryCategory } from "../../../shared/request-history-contract.js";

export interface ProcessHistoryEvent {
  kind: "start" | "event" | "end";
  at: string | null;
  label: string;
  actor: string | null;
  detail?: string;
  category?: typeof RequestHistoryCategory[keyof typeof RequestHistoryCategory];
}
