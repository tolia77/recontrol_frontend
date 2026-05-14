import { backendInstance } from "src/services/backend/config.ts";
import { getAccessToken } from "src/utils/auth.ts";

// D-12: per-step snapshot written by Scenario#before_save.
export interface ClassifiedIntentAtSave {
  decision: 'allow' | 'needs_confirm' | 'deny';
  reason: string;
  policy_version: string;
}

// D-10: verdict embedded in create/update response per step (not persisted; in-memory).
export interface VerdictAtSave {
  decision: 'allow' | 'needs_confirm' | 'deny';
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
  command_steps: Array<
    Omit<CommandStep, 'id' | 'classified_intent_at_save' | 'verdict_at_save'> & { id?: string }
  >;
}

export type ScenarioUpdatePayload = Partial<ScenarioCreatePayload>;

export interface PolicyPreviewStep {
  step_index: number;
  id: string;
  decision: 'allow' | 'needs_confirm' | 'deny';
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
  decision: 'deny';
  reason: string;
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

export const scenariosService = {
  async index(params?: ScenarioIndexParams): Promise<Scenario[]> {
    const { data } = await backendInstance.get<Scenario[]>('/scenarios', {
      params: {
        ...(params?.q ? { q: params.q } : {}),
        ...(params?.pinned_device_id ? { pinned_device_id: params.pinned_device_id } : {}),
        ...(params?.page ? { page: params.page } : {}),
        ...(params?.per_page ? { per_page: params.per_page } : {}),
      },
      headers: { Authorization: getAccessToken() },
    });
    return data;
  },

  async show(id: string): Promise<Scenario> {
    const { data } = await backendInstance.get<Scenario>(`/scenarios/${id}`, {
      headers: { Authorization: getAccessToken() },
    });
    return data;
  },

  async create(payload: ScenarioCreatePayload): Promise<ScenarioWriteResponse> {
    const { data } = await backendInstance.post<ScenarioWriteResponse>(
      '/scenarios',
      { scenario: payload },
      { headers: { Authorization: getAccessToken() } }
    );
    return data;
  },

  async update(id: string, payload: ScenarioUpdatePayload): Promise<ScenarioWriteResponse> {
    const { data } = await backendInstance.patch<ScenarioWriteResponse>(
      `/scenarios/${id}`,
      { scenario: payload },
      { headers: { Authorization: getAccessToken() } }
    );
    return data;
  },

  async destroy(id: string): Promise<void> {
    await backendInstance.delete(`/scenarios/${id}`, {
      headers: { Authorization: getAccessToken() },
    });
  },

  async duplicate(id: string): Promise<ScenarioWriteResponse> {
    const { data } = await backendInstance.post<ScenarioWriteResponse>(
      `/scenarios/${id}/duplicate`,
      {},
      { headers: { Authorization: getAccessToken() } }
    );
    return data;
  },

  // POLICY-01
  async policyPreview(id: string, deviceId: string): Promise<PolicyPreviewResponse> {
    const { data } = await backendInstance.get<PolicyPreviewResponse>(
      `/scenarios/${id}/policy_preview`,
      {
        params: { device_id: deviceId },
        headers: { Authorization: getAccessToken() },
      }
    );
    return data;
  },
};
