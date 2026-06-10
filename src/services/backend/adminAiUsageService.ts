import { BaseService } from "src/services/backend/BaseService.ts";

export interface AiUsageRow {
  user_id: string;
  username: string;
  day: string; // "YYYY-MM-DD"
  total_tokens: number;
  session_count: number;
  top_model: string;
}

class AdminAiUsageService extends BaseService {
  async index(): Promise<AiUsageRow[]> {
    const res = await this.api.get<AiUsageRow[]>("/admin/ai-usage");
    return res.data ?? [];
    // No pagination — res.meta is null; never access res.meta.total
  }
}

export const adminAiUsageService = new AdminAiUsageService();
