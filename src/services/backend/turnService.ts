import { BaseService } from "src/services/backend/BaseService.ts";

export interface TurnCredentialsResponse {
  ice_servers: RTCIceServer[];
}

class TurnService extends BaseService {
  async getCredentials() {
    return await this.api.get<TurnCredentialsResponse>("/turn-credentials");
  }
}

export const turnService = new TurnService();
