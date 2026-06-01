import { BaseService } from "src/services/backend/BaseService.ts";

// D-12: per-step snapshot written by Scenario#before_save.
export interface ClassifiedIntentAtSave {
  decision: "allow" | "needs_confirm" | "deny";
  reason: string;
  policy_version: string;
}

// D-10: verdict embedded in create/update response per step (not persisted; in-memory).
export interface VerdictAtSave {
  decision: "allow" | "needs_confirm" | "deny";
  reason: string;
}

export interface CommandStep {
  id: string;
  binary: string;
  args: string[];
  cwd: string;
  description?: string | null;
  classified_intent_at_save?: ClassifiedIntentAtSave;
  verdict_at_save?: VerdictAtSave;
}

export interface Scenario {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  command_steps: CommandStep[];
  pinned_device_id: string | null;
  is_shared: boolean;
  created_via_ai: boolean;
  owner_email?: string | null;
  created_at: string;
  updated_at: string;
  // Derived (LIB-02): present on `index`.
  last_run_at?: string | null;
  run_count?: number;
}

export interface ScenarioCreatePayload {
  name: string;
  description?: string | null;
  pinned_device_id?: string | null;
  is_shared?: boolean;
  // Phase 23 / Plan 23-09 (AI-09 / D-10): set true by the DraftReviewModal
  // Accept-and-save path so the backend stamps `created_via_ai: true` on the
  // persisted Scenario row. Optional — manual editor saves omit it (default
  // false on the backend `before_validation` hook).
  created_via_ai?: boolean;
  // Phase 23 / Plan 23-11 (AI-10): OpenRouter `usage.total_tokens` captured at
  // draft generation time and forwarded on [Accept and save]. The backend
  // nullifies this field when `created_via_ai != true` (T-23-44 guard), so it
  // is safe to send unconditionally — but in practice the modal only sends it
  // alongside `created_via_ai: true`.
  created_via_ai_token_count?: number;
  command_steps: Array<
    Omit<
      CommandStep,
      "id" | "classified_intent_at_save" | "verdict_at_save"
    > & { id?: string }
  >;
}

export type ScenarioUpdatePayload = Partial<ScenarioCreatePayload>;

export interface PolicyPreviewStep {
  step_index: number;
  id: string;
  decision: "allow" | "needs_confirm" | "deny";
  reason: string;
  classified_intent?: ClassifiedIntentAtSave;
  resolved_binary: string | null;
}

export interface PolicyPreviewResponse {
  steps: PolicyPreviewStep[];
  current_policy_version: string;
  policy_drift: boolean;
}

// D-10: 422 deny envelope (one entry per denied step).
export interface PolicyDenyError {
  step_index: number;
  decision: "deny";
  reason: string;
}

// ────────────────────────────────────────────────────────────────────────────
// AI draft generation (Phase 23) — D-12: drafts have no step `id`; backend
// `before_validation` hook assigns UUIDs only at save time. The amber
// `dry_intent_warning` is draft-time-only and is discarded on [Accept and save]
// (D-11): saved scenarios are independently re-classified by the run-time
// irreversible-intent catalog inside PolicyPreviewModal.
// ────────────────────────────────────────────────────────────────────────────

// AI-05 frontend half: shape produced by `CommandPolicy.dry_intent_check`
// (recontrol_backend/app/services/command_policy/dry_intent_patterns.rb).
// `message_key` matches /\Ascenarios\.ai\.dry_intent\.[a-z_]+\z/ — the frontend
// passes it directly to i18next to render the localized tooltip.
export interface DryIntentWarning {
  pattern: string;
  message_key: string;
}

// Per-step draft shape returned by POST /scenarios/drafts. NO `id` per D-12.
// `description` is `string | null` (model may emit JSON null). The optional
// `dry_intent_warning` is absent when no draft-time heuristic pattern matched.
export interface DraftStep {
  binary: string;
  args: string[];
  cwd: string;
  description: string | null;
  dry_intent_warning?: DryIntentWarning;
}

// Quota piggyback per AI-06 / AI-07: shared token ledger + independent
// 30/day drafts counter. Used to drive the quota indicator UI.
export interface DraftQuota {
  tokens_used: number;
  tokens_limit: number;
  drafts_used: number;
  drafts_limit: number;
}

// Per-call OpenRouter usage piggyback. Phase 23 / Plan 23-11 (AI-10):
// `total_tokens = prompt_tokens + completion_tokens`. The DraftReviewModal
// Accept handler captures this number and forwards it to `scenariosService.create`
// as `created_via_ai_token_count` so the backend persists it on the row and
// later copies it to `scenario_runs.total_ai_gen_tokens` at run start.
export interface DraftUsage {
  total_tokens: number;
}

// Top-level response envelope: { draft: {...}, quota: {...}, usage: {...} }
export interface DraftResponse {
  draft: {
    name: string;
    description: string;
    command_steps: DraftStep[];
  };
  quota: DraftQuota;
  // Phase 23 / Plan 23-11 (AI-10) — surfaced by the backend so the frontend
  // can persist `created_via_ai_token_count` on Accept.
  usage: DraftUsage;
}

export interface ScenarioWriteResponse {
  scenario: Scenario;
}

export interface ScenarioIndexParams {
  q?: string;
  pinned_device_id?: string;
  page?: number;
  per_page?: number;
}

class ScenariosService extends BaseService {
  async index(params?: ScenarioIndexParams): Promise<Scenario[]> {
    const { data } = await this.api.get<Scenario[]>("/scenarios", {
      params: {
        ...(params?.q ? { q: params.q } : {}),
        ...(params?.pinned_device_id
          ? { pinned_device_id: params.pinned_device_id }
          : {}),
        ...(params?.page ? { page: params.page } : {}),
        ...(params?.per_page ? { per_page: params.per_page } : {}),
      },
    });
    return data;
  }

  async show(id: string): Promise<Scenario> {
    const { data } = await this.api.get<Scenario>(`/scenarios/${id}`);
    return data;
  }

  async create(payload: ScenarioCreatePayload): Promise<ScenarioWriteResponse> {
    const { data } = await this.api.post<ScenarioWriteResponse>("/scenarios", {
      scenario: payload,
    });
    this.refreshUsage(); // scenario_limit changed
    return data;
  }

  // AI-01 frontend half: POST /scenarios/drafts. Generating a draft consumes the
  // daily AI-draft quota (ai_draft_daily_limit), so refresh usage on success.
  async createDraft(
    prompt: string,
    locale: string,
    signal?: AbortSignal,
  ): Promise<DraftResponse> {
    const { data } = await this.api.post<DraftResponse>(
      "/scenarios/drafts",
      { prompt },
      {
        headers: {
          "Accept-Language": locale,
        },
        signal,
      },
    );
    this.refreshUsage(); // ai_draft_daily_limit changed
    return data;
  }

  async update(
    id: string,
    payload: ScenarioUpdatePayload,
  ): Promise<ScenarioWriteResponse> {
    const { data } = await this.api.patch<ScenarioWriteResponse>(
      `/scenarios/${id}`,
      { scenario: payload },
    );
    return data;
  }

  async destroy(id: string): Promise<void> {
    await this.api.delete(`/scenarios/${id}`);
    this.refreshUsage(); // scenario_limit changed
  }

  async duplicate(id: string): Promise<ScenarioWriteResponse> {
    const { data } = await this.api.post<ScenarioWriteResponse>(
      `/scenarios/${id}/duplicate`,
      {},
    );
    this.refreshUsage(); // scenario_limit changed
    return data;
  }

  // POLICY-01
  async policyPreview(
    id: string,
    deviceId: string,
  ): Promise<PolicyPreviewResponse> {
    const { data } = await this.api.get<PolicyPreviewResponse>(
      `/scenarios/${id}/policy-preview`,
      {
        params: { device_id: deviceId },
      },
    );
    return data;
  }
}

export const scenariosService = new ScenariosService();
