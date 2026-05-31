import { backendInstance } from "src/services/backend/config.ts";

export interface TurnCredentialsResponse {
  ice_servers: RTCIceServer[];
}

export async function getTurnCredentialsRequest() {
  return await backendInstance.get<TurnCredentialsResponse>(
    "/turn-credentials",
  );
}
