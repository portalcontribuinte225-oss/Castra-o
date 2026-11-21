import type { StaffNotificationType } from "../../../shared/staff-notifications-contract.js";
import type { AnyRecord } from "../../types";

export interface StaffNotification {
  id: string;
  requestId: string;
  municipalityId: string;
  type: typeof StaffNotificationType[keyof typeof StaffNotificationType];
  protocol: string;
  createdAt: string;
  read: boolean;
}

export interface StaffNotificationPage {
  items: StaffNotification[];
  unreadCount: number;
  nextCursor: string | null;
}

export interface OpenStaffNotification {
  request: AnyRecord;
  unreadCount: number;
}
