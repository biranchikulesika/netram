import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuditEvent, AuditListQuery } from "@netram/types";
import type { AuditRepositoryPort } from "./ports/audit-repository.js";

const READ = "audit:read" as const;

export class AuditService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repository: AuditRepositoryPort,
  ) {}

  async listAuditEvents(
    ctx: RequestUserContext,
    query: AuditListQuery,
  ): Promise<{
    items: AuditEvent[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.authz.requirePermission(ctx, READ);

    const pageNum = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const page = await this.repository.list({
      ...query,
      page: pageNum,
      pageSize,
    });
    return { items: page.items, total: page.total, page: pageNum, pageSize };
  }
}
