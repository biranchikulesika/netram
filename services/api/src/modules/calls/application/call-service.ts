import type { CallRepository } from "@netram/data";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { CallContact, CallRecord, CreateCallRecordInput } from "@netram/types";
import type { ListCallHistoryQuery } from "@netram/validation";

export class CallService {
  constructor(private readonly callRepo: CallRepository) {}

  async listContacts(_ctx?: RequestUserContext): Promise<CallContact[]> {
    return this.callRepo.listContacts();
  }

  async listCallHistory(
    _ctx?: RequestUserContext,
    query?: ListCallHistoryQuery,
  ): Promise<CallRecord[]> {
    return this.callRepo.listCallHistory(query);
  }

  async createCallRecord(
    _ctx: RequestUserContext | undefined,
    input: CreateCallRecordInput,
  ): Promise<CallRecord> {
    return this.callRepo.createCallRecord(input);
  }
}
