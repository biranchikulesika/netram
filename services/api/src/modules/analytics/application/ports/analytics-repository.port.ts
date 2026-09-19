import type { AuthorityAnalyticsOverview } from "@netram/types";
import type { AnalyticsRepositoryFilter } from "@netram/data";

export interface AnalyticsRepositoryPort {
  getAuthorityAnalytics(filter: AnalyticsRepositoryFilter): Promise<AuthorityAnalyticsOverview>;
}
