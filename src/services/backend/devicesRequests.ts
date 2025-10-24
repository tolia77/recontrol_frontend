import {backendInstance} from "src/services/backend/config.ts";
import {getAccessToken} from "src/utils/auth.ts";

export async function getMyDevicesRequest() {
    return await backendInstance.get("/devices/me", {
        headers: {
            Authorization: getAccessToken()
        }
    })
}