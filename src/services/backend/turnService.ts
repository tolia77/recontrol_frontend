import { BaseService } from "src/services/backend/BaseService.ts";

export interface TurnCredentialsResponse {
  ice_servers: RTCIceServer[];
}

class TurnService extends BaseService {
  async getCredentials(): Promise<TurnCredentialsResponse> {
    const res = await this.api.get<TurnCredentialsResponse>("/turn-credentials");
    return res.data;
  }
}

export const turnService = new TurnService();
