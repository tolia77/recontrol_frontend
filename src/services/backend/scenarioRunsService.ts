import { BaseService } from "src/services/backend/BaseService.ts";

export type ScenarioRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "user_stopped"
  | "policy_deny"
  | "tab_closed"
  | "access_revoked"
  | "abandoned"
  | "error";

// Per-step status enum sourced from `recontrol_backend/app/models/scenario_run_step.rb`
// (STATUSES = %w[running success failed skipped policy_denied timeout]).
// Consumed by Plan 22.09 ScenariosHistory glyph timeline + Plan 22.10 HistoryDetail.
export type ScenarioRunStepStatus =
  | "running"
  | "success"
  | "failed"
  | "skipped"
  | "policy_denied"
  | "timeout";

export interface ScenarioRunStep {
  id: string;
  scenario_run_id: string;
  step_index: number;
  binary: string;
  status: ScenarioRunStepStatus;
  exit_code: number | null;
  stderr_first_line: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
}

export interface ScenarioRun {
  id: string;
  user_id: string;
  device_id: string | null;
  scenario_id: string | null;
  scenario_name_snapshot: string;
  step_count: number;
  started_at: string | null;
  ended_at: string | null;
  status: ScenarioRunStatus;
  failed_step_index: number | null;
  total_ai_gen_tokens: number | null;
  created_at: string;
  updated_at: string;
  // Populated by show(); index() may omit it. The Plan 22.09 history list
  // gracefully degrades to a badge-only row when steps is absent.
  steps?: ScenarioRunStep[];
}

export interface ScenarioRunIndexParams {
  page?: number;
  per_page?: number;
}

export interface ScenarioRunIndexResult {
  runs: ScenarioRun[];
  total: number;
}

class ScenarioRunsService extends BaseService {
  async index(
    params?: ScenarioRunIndexParams,
  ): Promise<ScenarioRunIndexResult> {
    const res = await this.api.get<ScenarioRun[]>("/scenario-runs", {
      params: {
        ...(params?.page ? { page: params.page } : {}),
        ...(params?.per_page ? { per_page: params.per_page } : {}),
      },
    });
    return { runs: res.data, total: res.meta?.total ?? 0 };
  }

  async show(id: string): Promise<ScenarioRun> {
    const res = await this.api.get<ScenarioRun>(`/scenario-runs/${id}`);
    return res.data;
  }

  // AUDIT-05 / D-14
  async destroy(id: string): Promise<void> {
    await this.api.delete(`/scenario-runs/${id}`);
  }

  async destroyAll(): Promise<void> {
    await this.api.delete("/scenario-runs/destroy-all");
  }
}

export const scenarioRunsService = new ScenarioRunsService();
