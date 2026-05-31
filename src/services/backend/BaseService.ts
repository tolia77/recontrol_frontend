import { backendInstance } from "src/services/backend/config.ts";
import { triggerUsageInvalidation } from "src/utils/usageInvalidationBus.ts";

/**
 * Base for all backend request services. Holds the shared axios instance and
 * the usage-refresh trigger. Subclasses call `this.api` for requests and
 * `this.refreshUsage()` after a successful mutation that changes a gated count
 * (scenario_limit, ai_draft_daily_limit, device_limit).
 */
export abstract class BaseService {
  protected readonly api = backendInstance;

  /** Fire-and-forget: schedule a debounced subscription-usage refresh. */
  protected refreshUsage(): void {
    triggerUsageInvalidation();
  }
}
