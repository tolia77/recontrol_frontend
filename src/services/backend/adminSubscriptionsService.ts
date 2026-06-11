import { BaseService } from "src/services/backend/BaseService.ts";
import type { Meta } from "src/services/backend/envelope.ts";

// Types

export interface SubscriptionAdminRow {
  id: string;
  user_id: string;
  state: string;
  plan_name: string;
  period_start: string | null;
  period_end: string | null;
  scheduled_plan: string | null;
  price: number | null;
  currency: string | null;
  is_comp: boolean;
  created_at: string;
}

export interface BillingHistoryEvent {
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  created_at: string;
}

export interface AdminSubscriptionParams {
  state?: string;
  plan_id?: string;
  sort?: "created_at" | "period_end" | "state";
  direction?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

// AdminSubscriptionsService

class AdminSubscriptionsService extends BaseService {
  async list(
    params?: AdminSubscriptionParams,
  ): Promise<{ subscriptions: SubscriptionAdminRow[]; meta: Meta | null }> {
    const res = await this.api.get<SubscriptionAdminRow[]>(
      "/admin/subscriptions",
      {
        params: {
          ...(params?.state ? { state: params.state } : {}),
          ...(params?.plan_id ? { plan_id: params.plan_id } : {}),
          ...(params?.sort ? { sort: params.sort } : {}),
          ...(params?.direction ? { direction: params.direction } : {}),
          ...(params?.page ? { page: params.page } : {}),
          ...(params?.per_page ? { per_page: params.per_page } : {}),
        },
      },
    );
    return { subscriptions: res.data ?? [], meta: res.meta ?? null };
  }

  async billingHistory(id: string): Promise<BillingHistoryEvent[]> {
    const res = await this.api.get<BillingHistoryEvent[]>(
      `/admin/subscriptions/${id}/billing-history`,
    );
    // res.meta is null for this endpoint — do NOT access res.meta.total
    return res.data ?? [];
  }

  async override(payload: {
    user_id: string;
    plan_id: string;
  }): Promise<{ status: string }> {
    // The :id path segment is ignored by the backend — use a fixed placeholder.
    // The backend resolves the user from user_id in the body.
    const res = await this.api.patch<{ status: string }>(
      "/admin/subscriptions/override",
      payload,
    );
    return res.data;
  }

  async cancel(id: string): Promise<{ status: string }> {
    const res = await this.api.delete<{ status: string }>(
      `/admin/subscriptions/${id}`,
    );
    return res.data;
  }
}

export const adminSubscriptionsService = new AdminSubscriptionsService();
