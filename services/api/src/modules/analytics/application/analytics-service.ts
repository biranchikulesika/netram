import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AnalyticsRepositoryPort } from "./ports/analytics-repository.port.js";
import type { AnalyticsQuery, AuthorityAnalyticsOverview } from "@netram/types";

export class AnalyticsService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repository: AnalyticsRepositoryPort,
  ) {}

  async getOverview(
    ctx: RequestUserContext,
    query: AnalyticsQuery = {},
  ): Promise<AuthorityAnalyticsOverview> {
    const hasReportRead = this.authz.hasPermission(ctx, "report:read");
    const hasProjectRead = this.authz.hasPermission(ctx, "project:read");
    if (!hasReportRead && !hasProjectRead) {
      throw AppError.forbidden("Missing required permission: report:read or project:read");
    }

    const accessible = this.authz.accessibleDistrictIds(ctx);

    if (query.districtId && !this.authz.canAccessDistrict(ctx, query.districtId)) {
      throw AppError.forbidden("District is outside your jurisdiction.");
    }

    return this.repository.getAuthorityAnalytics({
      accessibleDistrictIds: accessible,
      filterDistrictId: query.districtId,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
    });
  }
}
