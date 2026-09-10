import type { UUID, ISODateTime } from "./common.js";

export const NOTIFICATION_STATUSES = ["pending", "read"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "inspection.assigned",
  "corrective_action.overdue",
  "ai.anomaly_detected",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  body: string | null;
  status: NotificationStatus;
  createdAt: ISODateTime;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
}
