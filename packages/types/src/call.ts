import type { UUID } from "./common.js";

export type CallRole = "staff" | "beneficiary";
export type CallDirection = "incoming" | "outgoing";
export type CallStatus = "answered" | "missed";
export type CallCondition = "satisfactory" | "minor_issue" | "critical_problem";

export interface CallContact {
  id: string;
  name: string;
  role: CallRole;
  title: string;
  projectId?: UUID | null;
  projectCode: string;
  projectName: string;
  phone: string;
  isOnline: boolean;
  avatarColor: string;
  videoUri?: string | null;
}

export interface CallRecord {
  id: string;
  contactId: string;
  contactName: string;
  contactTitle: string;
  role: CallRole;
  projectId?: UUID | null;
  projectName: string;
  projectCode: string;
  callType: "video";
  durationSeconds: number;
  timestamp: string;
  condition: CallCondition;
  reviewText: string;
  flagInspection: boolean;
  videoUri?: string | null;
  inspectorVideoUri?: string | null;
  direction: CallDirection;
  status: CallStatus;
  startedAt?: string | null;
  createdAt?: string;
}

export interface CreateCallRecordInput {
  id?: string;
  contactId: string;
  contactName: string;
  contactTitle: string;
  role: CallRole;
  projectId?: UUID | null;
  projectName: string;
  projectCode: string;
  callType?: "video";
  durationSeconds: number;
  timestamp?: string;
  condition: CallCondition;
  reviewText: string;
  flagInspection?: boolean;
  videoUri?: string | null;
  inspectorVideoUri?: string | null;
  direction?: CallDirection;
  status?: CallStatus;
}
